import { GoogleGenAI } from '@google/genai';
import { prisma } from '../../prisma/client';
import { GEMINI_API_KEY, GEMINI_MODEL } from '../../config/constants';
import { resolveLocationQuery, calculateHaversineDistance, estimateDurationMinutes, calculateRouteDetails } from '../../utils/geo';
import { calculateFareForType, calculateFaresAllCategories } from '../../modules/pricing/pricing.service';
import { assignDriverToBooking, findNearbyAvailableDrivers } from '../../modules/assignments/assignment.service';
import { generateMockRoutes, rankRoutes, generateRouteExplanation, evaluateTrafficChange, RouteOption } from '../../modules/routing/route.service';

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export interface ProcessAgentInput {
  userId: string;
  conversationId?: string;
  message: string;
  language?: 'en' | 'te';
}

export interface ProcessAgentOutput {
  conversationId: string;
  response: string;
  language: 'en' | 'te';
  intent: string;
  bookingDraft?: any;
  pendingAction?: string | null;
  activeBookingId?: string | null;
  toolExecuted?: string | null;
  actionResult?: any;
}

/**
 * Handle AI Humanoid Conversation with Tool Execution, Context State Machine, and Bilingual Response
 */
export async function processAgentMessage(input: ProcessAgentInput): Promise<ProcessAgentOutput> {
  const { userId, message, language: reqLang } = input;

  // 1. Fetch or create conversation context in DB
  let conversation = input.conversationId
    ? await prisma.conversation.findUnique({ where: { id: input.conversationId } })
    : await prisma.conversation.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
      });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        userId,
        preferredLanguage: reqLang || 'en',
        bookingContext: JSON.stringify({
          pickup: null,
          destination: null,
          pickupTime: null,
          vehicleType: 'SEDAN',
          state: 'IDLE'
        })
      }
    });
  }

  // Language precedence: explicit request > conversation setting > default
  let lang: 'en' | 'te' = reqLang || (conversation.preferredLanguage as 'en' | 'te') || 'en';
  let context = JSON.parse(conversation.bookingContext || '{}');

  // Record user message in DB
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: message
    }
  });

  const textLower = message.toLowerCase().trim();

  // 1.5. Check for Noise / Symbols / Gibberish (e.g., &^**@#(@(%%%%)
  if (isGibberishOrNoise(message)) {
    const resp = lang === 'te'
      ? 'క్షమించండి, మీ సందేశం నాకు అర్థం కాలేదు. దయచేసి మీకు ఎలాంటి క్యాబ్ సహాయం కావాలో స్పష్టంగా చెప్పండి (ఉదాహరణకు: "సికింద్రాబాద్ స్టేషన్‌కి క్యాబ్ బుక్ చేయి").'
      : 'I didn\'t quite catch that! Could you please tell me where you\'d like to go or how I can help with your ride today?';
    await recordAssistantMessage(conversation.id, resp, 'generalQuery');
    return { conversationId: conversation.id, response: resp, language: lang, intent: 'GENERAL_QUESTION', bookingDraft: context };
  }

  // 2. Check for Language Switching Command
  let languageSwitched = false;
  if (textLower.includes('telugu') || textLower.includes('తెలుగు') || textLower.includes('in telugu')) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { preferredLanguage: 'te' }
    });
    lang = 'te';
    languageSwitched = true;
  } else if (textLower.includes('english') || textLower.includes('ఇంగ్లీష్')) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { preferredLanguage: 'en' }
    });
    lang = 'en';
    languageSwitched = true;
  }

  // If the message is ONLY about switching language, respond immediately.
  // Otherwise, fall through so we don't drop the rest of their request (e.g., "Book a cab to the airport in Telugu")
  if (languageSwitched && message.split(' ').length <= 4) {
    const resp = lang === 'te' 
       ? 'ఖచ్చితంగా! ఇకపై నేను తెలుగులో మాట్లాడుతాను. మీకు ఎలాంటి క్యాబ్ సహాయం కావాలి?' 
       : 'Sure! I will continue in English. How can I help with your ride today?';
    await recordAssistantMessage(conversation.id, resp, 'CHANGE_LANGUAGE');
    return { conversationId: conversation.id, response: resp, language: lang, intent: 'CHANGE_LANGUAGE', bookingDraft: context };
  }

  // 3. Attempt Gemini API if key available
  let quotaExceeded = false;
  if (ai) {
    try {
      const geminiResult = await processWithGemini(conversation.id, userId, message, lang, context);
      if (geminiResult) return geminiResult;
    } catch (err: any) {
      console.warn('Gemini API Error:', err.message);
      
      // If quota exceeded (429), set flag and fall through to local NLU engine
      // The local engine will still perform bookings — we just notify user at the end
      if (err.message && (err.message.includes('429') || err.message.includes('Quota exceeded') || err.message.includes('RESOURCE_EXHAUSTED'))) {
        quotaExceeded = true;
        console.warn('Quota exceeded — falling through to local NLU engine to still handle booking actions...');
      } else {
        console.warn('Falling back to local bilingual NLU engine...');
      }
    }
  }

  // 4. Local High-Precision Bilingual NLU Rule & Tool Engine
  const localResult = await processWithLocalNLUEngine(conversation.id, userId, message, lang, context);

  // If quota was exceeded, append a small notice to the response (but the action was still performed!)
  if (quotaExceeded) {
    const quotaNotice = lang === 'te'
      ? '\n\n⚠️ [నోట్: Google Gemini AI నా పరిమితి అయిపోయింది, కానీ నేను built-in engine తో మీ రైడ్ process చేశాను!]'
      : '\n\n⚠️ [Note: Google Gemini AI quota exceeded — your request was processed using the built-in booking engine!]';
    
    localResult.response = localResult.response + quotaNotice;
  }

  return localResult;
}

/**
 * High-Precision Bilingual NLU & Tool Execution Engine
 */
async function processWithLocalNLUEngine(
  conversationId: string,
  userId: string,
  message: string,
  lang: 'en' | 'te',
  context: any
): Promise<ProcessAgentOutput> {
  const textLower = message.toLowerCase().trim();
  const geminiIntent = context._geminiHints?.intent;

  // --- ENTITY EXTRACTION & CONTEXT FOLLOW-UP RECOGNITION ---
  let draftModified = false;
  const hadExistingDraft = Boolean(
    context.pickup ||
    context.destination ||
    context.pickupTime ||
    (context.state && ['COLLECTING_PICKUP', 'COLLECTING_DESTINATION', 'COLLECTING_VEHICLE', 'COLLECTING_TIME', 'AWAITING_CONFIRMATION', 'AWAITING_CANCEL_CONFIRMATION'].includes(context.state))
  );
  const extracted = extractPickupAndDrop(message, context);

  // Use strict word boundary matching to prevent "ok" from matching inside "booking"
  const isAffirmative = containsWord(message, [
    'yes', 'yeah', 'confirm', 'book it', 'sure', 'ok', 'okay', 'proceed', 'do it',
    'అవును', 'సరే', 'ఒకే', 'బుక్ చేయి', 'ఖచ్చితంగా', 'ఓకే'
  ]);

  const isCancellation = containsWord(message, [
    'cancel', 'cancle', 'canel', 'cancal', 'cancell', 'abort', 'stop', 'no', 'dont', "don't", 'delete', 'remove',
    'వద్దు', 'రద్దు చేయి', 'రద్దు చేయండి', 'వద్దు వద్దు'
  ]) || geminiIntent === 'CANCEL_BOOKING';

  // PRIORITY 1: CANCELLATION & DELETION HANDLER (Always takes priority)
  if (context.state === 'AWAITING_CANCEL_CONFIRMATION') {
    if (isAffirmative) {
      const activeRide = await prisma.booking.findUnique({ where: { id: context.activeBookingId } });
      if (activeRide) {
        if (context.isDeleteReq) {
          if (activeRide.driverId) await prisma.driver.update({ where: { id: activeRide.driverId }, data: { availabilityStatus: 'AVAILABLE' } }).catch(() => {});
          await prisma.rideStatusHistory.deleteMany({ where: { bookingId: activeRide.id } });
          await prisma.booking.delete({ where: { id: activeRide.id } });
        } else {
          await prisma.booking.update({ where: { id: activeRide.id }, data: { status: 'CANCELLED' } });
          if (activeRide.driverId) await prisma.driver.update({ where: { id: activeRide.driverId }, data: { availabilityStatus: 'AVAILABLE' } }).catch(() => {});
        }
      }
      context = { state: 'IDLE' };
      await updateConversationContext(conversationId, context, 'IDLE');
      
      const resp = lang === 'te' ? `సరే, మీ రైడ్ విజయవంతంగా రద్దు చేయబడింది.` : `Done! Your ride has been successfully cancelled.`;
      await recordAssistantMessage(conversationId, resp, 'cancelRide');
      return { conversationId, response: resp, language: lang, intent: 'CANCEL_BOOKING', bookingDraft: context };
    } else if (isCancellation || containsWord(message, ['no', 'dont', 'wait', 'keep', 'వద్దు', 'కాదు'])) {
      context.state = 'IDLE'; // Reset state so they can do other things, their ride remains active
      await updateConversationContext(conversationId, context, 'IDLE');
      const resp = lang === 'te' ? `సరే, నేను రద్దు చేయను. మీ రైడ్ ఇంకా యాక్టివ్‌గానే ఉంది!` : `Alright, I won't cancel it. Your ride is still active!`;
      await recordAssistantMessage(conversationId, resp, 'abortCancel');
      return { conversationId, response: resp, language: lang, intent: 'GENERAL_QUESTION', bookingDraft: context };
    } else {
      const resp = lang === 'te' ? `దయచేసి నిర్ధారించండి: మీరు మీ రైడ్‌ను రద్దు చేయాలనుకుంటున్నారా? (అవును / కాదు)` : `Please confirm: Are you sure you want to cancel your ride? (Yes / No)`;
      await recordAssistantMessage(conversationId, resp, 'askCancelConfirmation');
      return { conversationId, response: resp, language: lang, intent: 'CANCEL_BOOKING', bookingDraft: context };
    }
  } else if (isCancellation) {
    const isDeleteReq = containsWord(message, ['delete', 'remove']);

    // Check for active or recently created database ride
    const activeRide = await prisma.booking.findFirst({
      where: {
        customerId: userId,
        ...(isDeleteReq ? {} : { status: { in: ['CONFIRMED', 'PENDING_ASSIGNMENT', 'MATCHING', 'IN_PROGRESS'] } })
      },
      orderBy: { createdAt: 'desc' }
    });

    if (activeRide) {
      context.state = 'AWAITING_CANCEL_CONFIRMATION';
      context.activeBookingId = activeRide.id;
      context.isDeleteReq = isDeleteReq;
      await updateConversationContext(conversationId, context, 'AWAITING_CANCEL_CONFIRMATION');

      const resp = lang === 'te' ? `మీరు ఖచ్చితంగా మీ యాక్టివ్ రైడ్‌ను రద్దు చేయాలనుకుంటున్నారా?` : `Are you sure you want to cancel your active ride?`;
      await recordAssistantMessage(conversationId, resp, 'askCancelConfirmation');
      return { conversationId, response: resp, language: lang, intent: 'CANCEL_BOOKING', bookingDraft: context };
    } else if (context.pickup || context.destination || context.state === 'AWAITING_CONFIRMATION') {
      context = { state: 'IDLE' };
      await updateConversationContext(conversationId, context, 'IDLE');
      const resp = lang === 'te' ? `నేను మీ ప్రస్తుత బుకింగ్ డ్రాఫ్ట్‌ని క్లియర్ చేశాను.` : `No worries, I have cancelled that booking draft for you. Just let me know when you are ready to book!`;
      await recordAssistantMessage(conversationId, resp, 'cancelDraft');
      return { conversationId, response: resp, language: lang, intent: 'CANCEL_BOOKING', bookingDraft: context };
    } else {
      const resp = lang === 'te' ? 'క్యాన్సిల్ చేయడానికి మీ ఖాతాలో ఎలాంటి రైడ్ లేదా డ్రాఫ్ట్ కనుగొనబడలేదు.' : 'I couldn\'t find any active ride or draft on your account to cancel.';
      await recordAssistantMessage(conversationId, resp, 'generalQuery');
      return { conversationId, response: resp, language: lang, intent: 'GENERAL_QUESTION', bookingDraft: context };
    }
  }

  // PRIORITY 1.5: GENERAL KNOWLEDGE / GREETING / CHIT-CHAT HANDLER
  if (isGeneralQueryOrGreeting(message) && !isAffirmative && !extracted.pickup && !extracted.drop) {
    context.pickup = null;
    context.destination = null;
    context.state = 'IDLE';
    await updateConversationContext(conversationId, context, 'IDLE');

    const resp = generateLocalGeneralAnswer(message, lang);
    await recordAssistantMessage(conversationId, resp, 'generalQuestion');
    return { conversationId, response: resp, language: lang, intent: 'GENERAL_QUESTION', bookingDraft: context };
  }

  // A1. Follow-up state: Agent was waiting for pickup location
  if (context.state === 'COLLECTING_PICKUP' && !isAffirmative) {
    let loc = extracted.pickup || message.replace(/^(my|the|pickup|pick me up at|from|it's|at)\s+/i, '').trim();
    if (loc.toLowerCase().includes('home') || loc.toLowerCase().includes('ఇంటి') || loc.toLowerCase().includes('ఇల్లు')) {
      loc = 'Customer Saved Address: Home (Banjara Hills)';
    } else if (loc.toLowerCase().includes('office') || loc.toLowerCase().includes('ఆఫీస్')) {
      loc = 'Customer Saved Address: Office (Hitec City)';
    }
    if (loc && loc.length > 1 && context.pickup !== loc) {
      context.pickup = loc;
      draftModified = true;
    }
  }

  // A2. Follow-up state: Agent was waiting for destination
  if (context.state === 'COLLECTING_DESTINATION' && !isAffirmative) {
    let loc = extracted.drop || message.replace(/^(to|drop me at|destination|heading to|it's|at)\s+/i, '').trim();
    if (loc && loc.length > 1 && context.destination !== loc) {
      context.destination = loc;
      draftModified = true;
    }
  }

  // A2_a. Follow-up state: Agent was waiting for vehicle type
  if (context.state === 'COLLECTING_VEHICLE' && !isAffirmative) {
    const vMatch = message.match(/(sedan|auto|suv|bike|mini|hatchback|సెడాన్|ఆటో|మినీ)/i);
    if (vMatch) {
      let vType = vMatch[1].toUpperCase();
      if (vType === 'సెడాన్') vType = 'SEDAN';
      if (vType === 'ఆటో') vType = 'AUTO';
      if (vType === 'మినీ' || vType === 'MINI') vType = 'HATCHBACK';
      context.vehicleType = vType;
      draftModified = true;
    }
  }

  // A2_b. Follow-up state: Agent was waiting for pickup time
  if (context.state === 'COLLECTING_TIME' && !isAffirmative) {
    const timeMatch = message.match(/(\d{1,2}(?::\d{2})?\s*(?:pm|am|గంటల|గంటలకు))|now|later|ఇప్పుడు/i);
    if (timeMatch) {
      let matchedTime = timeMatch[0].toLowerCase();
      if (matchedTime === 'now' || matchedTime === 'ఇప్పుడు') matchedTime = 'now';
      context.pickupTime = matchedTime;
      draftModified = true;
    }
  }

  // A3. Direct entity updates from extracted text
  if (extracted.pickup && context.pickup !== extracted.pickup) {
    context.pickup = extracted.pickup;
    if (hadExistingDraft) draftModified = true;
  }
  if (extracted.drop && context.destination !== extracted.drop) {
    context.destination = extracted.drop;
    if (hadExistingDraft) draftModified = true;
  }

  // A4. Mid-conversation time modifications (e.g. "Actually, make it 7 PM instead of 6 PM", "tomorrow")
  const insteadTimeMatch = message.match(/(\d{1,2}(?::\d{2})?\s*(?:pm|am|గంటల|గంటలకు))\s+(?:instead of|కాకుండా)/i);
  const generalTimeMatch = message.match(/(\d{1,2}(?::\d{2})?\s*(?:pm|am|గంటల|గంటలకు))/i);
  const timeWordMatch = message.match(/\b(tomorrow|tommorow|today|now|later|morning|evening|afternoon|tonight|రేపు|ఈరోజు|ఉదయం|సాయంత్రం|రాత్రి)\b/i);
  const newTime = insteadTimeMatch ? insteadTimeMatch[1] : (context._geminiHints?.entities?.time || (generalTimeMatch ? generalTimeMatch[1] : (timeWordMatch ? timeWordMatch[1] : null)));

  if (newTime && context.pickupTime !== newTime) {
    context.pickupTime = newTime;
    if (hadExistingDraft) draftModified = true;
  }

  // A5. Mid-conversation vehicle modifications (e.g. "Make it Sedan", "Auto instead")
  const vehicleMatch = message.match(/(sedan|auto|suv|bike|mini|సెడాన్|ఆటో)/i);
  if (vehicleMatch) {
    let vType = vehicleMatch[1].toUpperCase();
    if (vType === 'సెడాన్') vType = 'SEDAN';
    if (vType === 'ఆటో') vType = 'AUTO';
    if (context.vehicleType !== vType) {
      context.vehicleType = vType;
      if (hadExistingDraft) draftModified = true;
    }
  }

  // Check saved home/work shortcuts if pickup is still unassigned
  if ((textLower.includes('home') || textLower.includes('ఇంటి') || textLower.includes('ఇల్లు')) && !context.pickup) {
    context.pickup = 'Customer Saved Address: Home (Banjara Hills)';
    if (hadExistingDraft) draftModified = true;
  }

  // B. CONFIRMATION HANDLER (If pending confirmation and user confirms)
  if (context.state === 'AWAITING_CONFIRMATION') {
    if (isAffirmative && !draftModified) {
      // Execute actual booking in database & assign driver
      const resolvedP = resolveLocationQuery(context.pickup || 'Banjara Hills');
      const resolvedD = resolveLocationQuery(context.destination || 'Secunderabad Station');
      const distanceKm = context.distanceKm || calculateHaversineDistance(resolvedP.lat, resolvedP.lng, resolvedD.lat, resolvedD.lng);
      const duration = context.duration || estimateDurationMinutes(distanceKm);
      const trafficLevel = context.trafficLevel || 'LOW';
      const fareInfo = await calculateFareForType(context.vehicleType || 'SEDAN', distanceKm, duration, trafficLevel);

      // Auto-cancel any existing active rides (handles Rebooking scenario)
      const existingActiveRides = await prisma.booking.findMany({
        where: { customerId: userId, status: { in: ['CONFIRMED', 'PENDING_ASSIGNMENT', 'MATCHING', 'IN_PROGRESS'] } }
      });
      for (const existingRide of existingActiveRides) {
        await prisma.booking.update({ where: { id: existingRide.id }, data: { status: 'CANCELLED' } });
        if (existingRide.driverId) {
          await prisma.driver.update({ where: { id: existingRide.driverId }, data: { availabilityStatus: 'AVAILABLE' } }).catch(() => {});
        }
      }

      const booking = await prisma.booking.create({
        data: {
          customerId: userId,
          pickupAddress: resolvedP.address,
          pickupLatitude: resolvedP.lat,
          pickupLongitude: resolvedP.lng,
          dropAddress: resolvedD.address,
          dropLatitude: resolvedD.lat,
          dropLongitude: resolvedD.lng,
          distanceKm,
          estimatedDurationMinutes: duration,
          estimatedFare: fareInfo.totalFare,
          currency: 'INR',
          status: 'PENDING_ASSIGNMENT'
        }
      });

      const assignment = await assignDriverToBooking(booking.id, context.vehicleType);

      if (!assignment || !assignment.driver) {
         // No driver available fallback
         await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
         
         const resp = lang === 'te' 
           ? `క్షమించండి, మీ రూట్‌లో ప్రస్తుతం ${context.vehicleType || 'క్యాబ్'}లు అందుబాటులో లేవు. దయచేసి కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.`
           : `I'm really sorry, but it seems there are no ${context.vehicleType || 'cab'}s available around ${resolvedP.name} right now. Please try again in a few minutes.`;
         
         // Reset state so they can try again later
         context.state = 'IDLE';
         await updateConversationContext(conversationId, context, 'CONFIRM_BOOKING');
         await recordAssistantMessage(conversationId, resp, 'confirmBookingError');

         return {
           conversationId,
           response: resp,
           language: lang,
           intent: 'CONFIRM_BOOKING',
           bookingDraft: context,
           toolExecuted: 'confirmBookingError'
         };
      }

      // Reset context state on success
      context.state = 'BOOKED';
      context.activeBookingId = booking.id;
      await updateConversationContext(conversationId, context, 'CONFIRM_BOOKING');

      const driverInfo = assignment.driver
        ? (lang === 'te'
            ? `\n\n👨‍✈️ డ్రైవర్ వివరాలు:\n• పేరు: ${assignment.driver.driverName} (${assignment.driver.rating.toFixed(1)}⭐)\n• ఫోన్: ${assignment.driver.phone}\n• వాహనం: ${assignment.driver.vehicleColor} ${assignment.driver.vehicleModel} (${assignment.driver.vehicleReg})\n• దూరం: ${assignment.driver.distanceKm.toFixed(1)} కి.మీ (${assignment.driver.etaMinutes} నిమిషాల్లో వస్తారు)`
            : `\n\n👨‍✈️ Driver Details:\n• Name: ${assignment.driver.driverName} (${assignment.driver.rating.toFixed(1)}⭐)\n• Phone: ${assignment.driver.phone}\n• Vehicle: ${assignment.driver.vehicleColor} ${assignment.driver.vehicleModel} (${assignment.driver.vehicleReg})\n• Distance: ${assignment.driver.distanceKm.toFixed(1)} km away (Arriving in ~${assignment.driver.etaMinutes} mins)`)
        : '';

      const resp = lang === 'te'
        ? `అద్భుతం, మీ రైడ్ కన్ఫర్మ్ అయిపోయింది! 🚕 మీ డ్రైవర్ ${resolvedP.name} కి వస్తున్నారు. ${resolvedD.name} చేరుకోవడానికి దాదాపు ₹${fareInfo.totalFare} అవుతుంది. ${driverInfo}`
        : `Awesome, I've got your ride sorted! 🚕 Your driver is on the way to pick you up from ${resolvedP.name}. It'll cost around ₹${fareInfo.totalFare} to get to ${resolvedD.name}. ${driverInfo}`;

      await recordAssistantMessage(conversationId, resp, 'confirmBooking', JSON.stringify({ bookingId: booking.id }));

      return {
        conversationId,
        response: resp,
        language: lang,
        intent: 'CONFIRM_BOOKING',
        bookingDraft: context,
        activeBookingId: booking.id,
        toolExecuted: 'confirmBooking',
        actionResult: { booking, assignment }
      };
    }
  }


  // C. SHOW AVAILABLE CABS QUERY (e.g., "Show me available cabs nearby", "cabs today", "cabs at 7 PM")
  if (
    geminiIntent === 'GET_AVAILABILITY' ||
    textLower.includes('available cab') ||
    textLower.includes('available ride') ||
    textLower.includes('cabs nearby') ||
    textLower.includes('rides nearby') ||
    textLower.includes('cabs today') ||
    textLower.includes('show available') ||
    textLower.includes('show cabs') ||
    textLower.includes('nearby cabs') ||
    textLower.includes('క్యాబ్‌లు')
  ) {
    const pStr = context.pickup || 'Banjara Hills';
    const pRes = resolveLocationQuery(pStr);
    const nearbyDrivers = await findNearbyAvailableDrivers(pRes.lat, pRes.lng);
    const count = nearbyDrivers.length > 0 ? nearbyDrivers.length : 4;

    const timeDetail = context.pickupTime ? ` for ${context.pickupTime}` : ' right now';

    let cabsListEn = '';
    let cabsListTe = '';
    
    if (nearbyDrivers.length > 0) {
      const displayDrivers = nearbyDrivers.slice(0, 3);
      cabsListEn = displayDrivers.map(d => `• ${d.vehicleType} (${d.vehicleModel}) - ~${d.etaMinutes} mins away (${d.distanceKm.toFixed(1)} km)`).join('\n');
      cabsListTe = displayDrivers.map(d => `• ${d.vehicleType} (${d.vehicleModel}) - ${d.etaMinutes} నిమిషాల దూరంలో (${d.distanceKm.toFixed(1)} కి.మీ)`).join('\n');

      const resp = lang === 'te'
        ? `${pRes.name} దగ్గర ప్రస్తుతం ${count} క్యాబ్‌లు అందుబాటులో ఉన్నాయి! 🚕\n\n${cabsListTe}\n\nమీరు ఎక్కడికి ప్రయాణించాలనుకుంటున్నారు?`
        : `I found ${count} available cabs near ${pRes.name}${timeDetail}! 🚕\n\n${cabsListEn}\n\nWhere would you like to travel today?`;
      
      await recordAssistantMessage(conversationId, resp, 'getAvailability');
      return { conversationId, response: resp, language: lang, intent: 'GET_AVAILABILITY', bookingDraft: context };
    } else {
      const resp = lang === 'te'
        ? `క్షమించండి, ${pRes.name} దగ్గర ప్రస్తుతం క్యాబ్‌లు ఏవీ అందుబాటులో లేవు. 😔`
        : `Sorry, I couldn't find any available cabs near ${pRes.name}${timeDetail}. 😔`;
      
      await recordAssistantMessage(conversationId, resp, 'getAvailability');
      return { conversationId, response: resp, language: lang, intent: 'GET_AVAILABILITY', bookingDraft: context };
    }
  }

  // D. RIDE STATUS / WHERE IS MY DRIVER
  if (geminiIntent === 'GET_RIDE_STATUS' || textLower.includes('where is my driver') || textLower.includes('status') || textLower.includes('track') || textLower.includes('డ్రైవర్ ఎక్కడ') || textLower.includes('ఎక్కడ ఉన్నాడు') || textLower.includes('స్టేటస్')) {

    const latestRide = await prisma.booking.findFirst({
      where: { customerId: userId, status: { in: ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'PENDING_ASSIGNMENT'] } },
      orderBy: { createdAt: 'desc' },
      include: { driver: { include: { user: true, vehicle: true } } }
    });

    if (!latestRide) {
      const resp = lang === 'te' ? 'ప్రస్తుతం మీకు ఎలాంటి యాక్టివ్ రైడ్స్ లేవు. నేను మీకు క్యాబ్ బుక్ చేయనా?' : 'It doesn\'t look like you have any active rides right now. Do you want me to help you book one?';
      await recordAssistantMessage(conversationId, resp, 'getRideStatus');
      return { conversationId, response: resp, language: lang, intent: 'GET_RIDE_STATUS', bookingDraft: context };
    }

    let statusText = '';
    if (latestRide.driver) {
      const dist = calculateHaversineDistance(latestRide.driver.currentLatitude, latestRide.driver.currentLongitude, latestRide.pickupLatitude, latestRide.pickupLongitude);
      const eta = estimateDurationMinutes(dist);
      const rating = 4.8 + (Math.random() * 0.2); // mock rating

      statusText = lang === 'te'
        ? `మీ డ్రైవర్, ${latestRide.driver.user.name} గారు (${rating.toFixed(1)}⭐), తమ ${latestRide.driver.vehicle?.color} ${latestRide.driver.vehicle?.model} (${latestRide.driver.vehicle?.registrationNumber}) కారులో వస్తున్నారు.\n\nప్రస్తుతం వారు ${dist.toFixed(1)} కి.మీ దూరంలో ఉన్నారు. సుమారు ${eta} నిమిషాల్లో మిమ్మల్ని చేరుకుంటారు! ఫోన్: ${latestRide.driver.user.phone}`
        : `Your driver, ${latestRide.driver.user.name} (${rating.toFixed(1)}⭐), is on the way in their ${latestRide.driver.vehicle?.color} ${latestRide.driver.vehicle?.model} (${latestRide.driver.vehicle?.registrationNumber}).\n\nThey are currently ${dist.toFixed(1)} km away and should reach you in about ${eta} minutes! Phone: ${latestRide.driver.user.phone}`;
        
      if (latestRide.status === 'IN_PROGRESS') {
        const currentRoute = { id: 'current', name: 'Current Route', distanceKm: dist, etaMinutes: eta + 5, trafficLevel: 'HIGH', congestion: 80 } as RouteOption;
        const alternates = generateMockRoutes(dist);
        const change = evaluateTrafficChange(currentRoute, alternates, lang);
        if (change.shouldSwitch) {
          statusText += `\n\n${change.message}`;
        }
      }
    } else {
      statusText = lang === 'te' ? 'మీ కోసం దగ్గరలో ఉన్న ఉత్తమ డ్రైవర్‌ని వెతుకుతున్నాను. దయచేసి కాసేపు ఆగండి!' : 'I\'m still looking for the perfect driver for you nearby. Give me just a moment!';
    }

    await recordAssistantMessage(conversationId, statusText, 'getRideStatus');
    return { conversationId, response: statusText, language: lang, intent: 'GET_RIDE_STATUS', activeBookingId: latestRide.id, bookingDraft: context };
  }

  // D. CANCEL OR DELETE RIDE IN DATABASE
  if (
    geminiIntent === 'CANCEL_BOOKING' ||
    textLower.includes('cancel') ||
    textLower.includes('cancle') ||
    textLower.includes('canel') ||
    textLower.includes('delete') ||
    textLower.includes('remove') ||
    textLower.includes('రద్దు')
  ) {
    const isDeleteReq = textLower.includes('delete') || textLower.includes('remove');
    
    // Find latest active or recently created ride
    const activeRide = await prisma.booking.findFirst({
      where: {
        customerId: userId,
        ...(isDeleteReq ? {} : { status: { in: ['CONFIRMED', 'PENDING_ASSIGNMENT', 'MATCHING', 'IN_PROGRESS'] } })
      },
      orderBy: { createdAt: 'desc' }
    });

    if (activeRide) {
      if (isDeleteReq) {
        // Physical database deletion
        if (activeRide.driverId) {
          await prisma.driver.update({ where: { id: activeRide.driverId }, data: { availabilityStatus: 'AVAILABLE' } }).catch(() => {});
        }
        await prisma.rideStatusHistory.deleteMany({ where: { bookingId: activeRide.id } });
        await prisma.booking.delete({ where: { id: activeRide.id } });

        context = { state: 'IDLE' };
        await updateConversationContext(conversationId, context, 'IDLE');

        const resp = lang === 'te' ? `సరే, మీ రైడ్ బుకింగ్ రద్దు మరియు తొలగించబడింది.` : `Done! I've removed your ride booking record.`;
        await recordAssistantMessage(conversationId, resp, 'deleteRide');
        return { conversationId, response: resp, language: lang, intent: 'DELETE_BOOKING', bookingDraft: context };
      } else {
        // Cancel status update in database
        await prisma.booking.update({ where: { id: activeRide.id }, data: { status: 'CANCELLED' } });
        if (activeRide.driverId) {
          await prisma.driver.update({ where: { id: activeRide.driverId }, data: { availabilityStatus: 'AVAILABLE' } });
        }
        
        context = { state: 'IDLE' };
        await updateConversationContext(conversationId, context, 'IDLE');
        
        const resp = lang === 'te' ? `సరే, మీ రైడ్ విజయవంతంగా క్యాన్సిల్ చేయబడింది. మీకు మళ్ళీ క్యాబ్ కావాలంటే చెప్పండి.` : `Done! Your ride has been cancelled. Let me know whenever you need another one!`;
        await recordAssistantMessage(conversationId, resp, 'cancelRide');
        return { conversationId, response: resp, language: lang, intent: 'CANCEL_BOOKING', bookingDraft: context };
      }
    } else {
      // If no active ride, but user has draft in context
      if (context.pickup || context.destination) {
        context = { state: 'IDLE' };
        await updateConversationContext(conversationId, context, 'IDLE');
        const resp = lang === 'te' ? `నేను మీ ప్రస్తుత బుకింగ్ డ్రాఫ్ట్‌ని క్లియర్ చేశాను.` : `I've cleared your current booking draft.`;
        await recordAssistantMessage(conversationId, resp, 'cancelDraft');
        return { conversationId, response: resp, language: lang, intent: 'CANCEL_BOOKING', bookingDraft: context };
      }

      const resp = lang === 'te' ? 'క్యాన్సిల్ లేదా డిలీట్ చేయడానికి మీ ఖాతాలో ఎలాంటి రైడ్ కనుగొనబడలేదు.' : 'I couldn\'t find any active ride on your account to modify or cancel.';
      await recordAssistantMessage(conversationId, resp, 'generalQuery');
      return { conversationId, response: resp, language: lang, intent: 'GENERAL_QUESTION', bookingDraft: context };
    }
  }

  // E. FARE ESTIMATE QUERY
  if (geminiIntent === 'GET_FARE_ESTIMATE' || textLower.includes('fare') || textLower.includes('estimate') || textLower.includes('cost') || textLower.includes('ఛార్జీ') || textLower.includes('ధర') || textLower.includes('ఖర్చు')) {
    const locations = extractPickupAndDrop(message, context);
    const pickupStr = locations.pickup || context.pickup || 'Banjara Hills';
    const dropStr = locations.drop || context.destination || 'Secunderabad Railway Station';

    const pRes = resolveLocationQuery(pickupStr);
    const dRes = resolveLocationQuery(dropStr);
    const dist = calculateHaversineDistance(pRes.lat, pRes.lng, dRes.lat, dRes.lng);
    const duration = estimateDurationMinutes(dist);
    const fares = await calculateFaresAllCategories(dist, duration);

    const sedanFare = fares.find(f => f.vehicleType === 'SEDAN')?.totalFare || 250;
    const autoFare = fares.find(f => f.vehicleType === 'AUTO')?.totalFare || 150;

    const resp = lang === 'te'
      ? `${pRes.name} నుండి ${dRes.name} కి వెళ్ళడానికి, ఆటోకి సుమారు ₹${autoFare} అవుతుంది, లేదా సెడాన్ కారుకి అయితే ₹${sedanFare} అవుతుంది. ప్రయాణానికి దాదాపు ${duration} నిమిషాలు పడుతుంది. నేను మీ కోసం బుక్ చేయనా?`
      : `To get from ${pRes.name} to ${dRes.name}, an Auto would be around ₹${autoFare}, or you could take a Sedan for about ₹${sedanFare}. The ride will take roughly ${duration} minutes. Should I go ahead and book one of these for you?`;

    await recordAssistantMessage(conversationId, resp, 'getFareEstimate');
    return { conversationId, response: resp, language: lang, intent: 'GET_FARE_ESTIMATE', bookingDraft: context };
  }

  // F. MISSING ENTITY CHECK & FOLLOW-UP QUESTIONS
  if (!context.pickup && !context.destination) {
    const resp = lang === 'te'
      ? 'తప్పకుండా, మీకు క్యాబ్ బుక్ చేస్తాను! మీరు ఎక్కడి నుండి ఎక్కడికి వెళ్ళాలి?'
      : 'I\'d love to help you book a ride! Just tell me where you are right now and where you want to go.';
    await recordAssistantMessage(conversationId, resp, 'generalQuery');
    return { conversationId, response: resp, language: lang, intent: 'GENERAL_RIDE_QUESTION', bookingDraft: context };
  }

  if (!context.pickup) {
    context.state = 'COLLECTING_PICKUP';
    await updateConversationContext(conversationId, context, 'COLLECTING_PICKUP');
    const resp = lang === 'te'
      ? `సరే, మనం ${context.destination} కి వెళ్దాం. డ్రైవర్ మిమ్మల్ని ఎక్కడ పిక్ చేసుకోవాలి?`
      : `Got it, we're heading to ${context.destination}. Where should the driver pick you up?`;
    await recordAssistantMessage(conversationId, resp, 'askPickup');
    return { conversationId, response: resp, language: lang, intent: 'CREATE_BOOKING', bookingDraft: context };
  }

  if (!context.destination) {
    context.state = 'COLLECTING_DESTINATION';
    await updateConversationContext(conversationId, context, 'COLLECTING_DESTINATION');
    const resp = lang === 'te'
      ? `సరే, డ్రైవర్ మిమ్మల్ని ${context.pickup} నుండి పిక్ చేసుకుంటారు. మనం ఎక్కడికి వెళ్లాలి?`
      : `Okay, picking you up from ${context.pickup}. Where are we heading to?`;
    await recordAssistantMessage(conversationId, resp, 'askDrop');
    return { conversationId, response: resp, language: lang, intent: 'CREATE_BOOKING', bookingDraft: context };
  }

  // G. BOTH PICKUP & DESTINATION ARE READY -> PREPARE OR UPDATE BOOKING DRAFT
  const pRes = resolveLocationQuery(context.pickup);
  const dRes = resolveLocationQuery(context.destination);

  // Prevent identical pickup and drop-off location draft generation
  if (pRes.address === dRes.address || pRes.name.toLowerCase() === dRes.name.toLowerCase()) {
    const resp = lang === 'te'
      ? `మీ పికప్ మరియు గమ్యస్థానం ఒకే ప్రదేశంగా (${pRes.name}) ఉన్నాయి. దయచేసి మీరు చేరుకోవాల్సిన ప్రదేశాన్ని తెలియజేయండి.`
      : `Your pickup and destination locations appear to be the same place (${pRes.name}). Where would you like to be dropped off?`;

    context.destination = null; // Clear invalid drop-off location
    context.state = 'COLLECTING_DESTINATION';
    await updateConversationContext(conversationId, context, 'COLLECTING_DESTINATION');
    await recordAssistantMessage(conversationId, resp, 'askDrop');
    return {
      conversationId,
      response: resp,
      language: lang,
      intent: 'CREATE_BOOKING',
      bookingDraft: context
    };
  }

  if (!context.vehicleType) {
    context.state = 'COLLECTING_VEHICLE';
    await updateConversationContext(conversationId, context, 'COLLECTING_VEHICLE');
    const resp = lang === 'te'
      ? `మనం వెళ్ళే దారి సెట్ అయ్యింది! మీకు ఏ రకమైన వాహనం కావాలి? (ఉదాహరణకు: ఆటో, మినీ, సెడాన్, లేదా SUV)`
      : `Route is set! What type of vehicle would you like to book? (e.g., Auto, Hatchback, Sedan, SUV)`;
    await recordAssistantMessage(conversationId, resp, 'askVehicle');
    return { conversationId, response: resp, language: lang, intent: 'CREATE_BOOKING', bookingDraft: context };
  }

  if (!context.pickupTime) {
    context.state = 'COLLECTING_TIME';
    await updateConversationContext(conversationId, context, 'COLLECTING_TIME');
    const pickupLabel = context.pickup || 'your pickup location';
    const destinationLabel = context.destination || 'your destination';
    const resp = lang === 'te'
      ? `సరే, ${pickupLabel} నుండి ${destinationLabel}కు ప్రయాణం సిద్ధంగా ఉంది. మీరు ఎప్పుడు బయలుదేరాలనుకుంటున్నారు? (ఇప్పుడా లేక నిర్దిష్ట సమయం)`
      : `Got it — you're heading from ${pickupLabel} to ${destinationLabel}. When would you like to leave? (Now or tell me a specific time)`;
    await recordAssistantMessage(conversationId, resp, 'askTime');
    return {
      conversationId,
      response: resp,
      language: lang,
      intent: draftModified ? 'UPDATE_DRAFT' : 'CREATE_BOOKING',
      bookingDraft: context
    };
  }

  const dist = calculateHaversineDistance(pRes.lat, pRes.lng, dRes.lat, dRes.lng);
  
  // Route Optimization Integration
  const mockRoutes = generateMockRoutes(dist);
  const rankedRoutes = rankRoutes(mockRoutes);
  const bestRoute = rankedRoutes[0];

  const duration = bestRoute.etaMinutes;
  const fareInfo = await calculateFareForType(context.vehicleType || 'SEDAN', bestRoute.distanceKm, duration, bestRoute.trafficLevel);

  context.state = 'AWAITING_CONFIRMATION';
  context.pickupAddress = pRes.address;
  context.dropAddress = dRes.address;
  context.estimatedFare = fareInfo.totalFare;
  context.distanceKm = bestRoute.distanceKm;
  context.duration = duration;
  context.trafficLevel = bestRoute.trafficLevel;
  await updateConversationContext(conversationId, context, 'AWAITING_CONFIRMATION');

  const routeExplanation = generateRouteExplanation(rankedRoutes, lang);

  const resp = draftModified
    ? (lang === 'te'
        ? `సరే! నేను మీ ప్రయాణ వివరాలను నవీకరించాను:\n📍 పికప్: ${pRes.name}\n🏁 గమ్యస్థానం: ${dRes.name}\n🚘 వాహనం: ${fareInfo.vehicleTypeName}\n🕒 సమయం: ${context.pickupTime || 'ఇప్పుడే'}\n\n${routeExplanation}\nఛార్జీ సుమారు ₹${fareInfo.totalFare} అవుతుంది. నేను మీ కోసం క్యాబ్ బుక్ చేయనా?`
        : `Got it! I've updated your ride details:\n📍 From: ${pRes.name}\n🏁 To: ${dRes.name}\n🚘 Vehicle: ${fareInfo.vehicleTypeName}\n🕒 Time: ${context.pickupTime || 'Now'}\n\n${routeExplanation}\nThe fare is around ₹${fareInfo.totalFare}. Should I go ahead and book it for you?`)
    : (lang === 'te'
        ? `సరే, మీ రైడ్ సిద్ధంగా ఉంది!\n📍 పికప్: ${pRes.name}\n🏁 గమ్యస్థానం: ${dRes.name}\n🚘 వాహనం: ${fareInfo.vehicleTypeName}\n\n${routeExplanation}\nఛార్జీ సుమారు ₹${fareInfo.totalFare} అవుతుంది. నేను మీ కోసం క్యాబ్ బుక్ చేయనా?`
        : `Okay, I've got your ride ready!\n📍 From: ${pRes.name}\n🏁 To: ${dRes.name}\n🚘 Vehicle: ${fareInfo.vehicleTypeName}\n\n${routeExplanation}\nThe fare is around ₹${fareInfo.totalFare}. Should I go ahead and book it for you?`);

  await recordAssistantMessage(conversationId, resp, draftModified ? 'updateBookingDraft' : 'prepareBookingDraft');
  return {
    conversationId,
    response: resp,
    language: lang,
    intent: draftModified ? 'UPDATE_DRAFT' : 'CREATE_BOOKING',
    pendingAction: 'CONFIRM_BOOKING',
    bookingDraft: context
  };
}

/**
 * Extract pickup and drop entities from natural text
 */
function extractPickupAndDrop(text: string, context: any = {}): { pickup: string | null; drop: string | null } {
  let pickup: string | null = null;
  let drop: string | null = null;

  // Patterns for English: "from X to Y", "to Y from X", "to Y"
  const fromToMatch = text.match(/(?:from|పికప్)\s+([^to|వరకు|కి|కు]+?)\s+(?:to|నగర్|వరకు|కి|కు)\s+(.+)/i);
  if (fromToMatch) {
    pickup = fromToMatch[1].trim();
    drop = fromToMatch[2].trim();
    return { pickup, drop };
  }

  // Explicit change commands
  const explicitDropMatch = text.match(/(?:change(?: my)? (?:drop(?:off)?|destination(?: location)?|location) to|drop(?: me)? at)\s+([a-zA-Z0-9\s]+)/i);
  if (explicitDropMatch) {
    drop = explicitDropMatch[1].trim();
  } else {
    const toMatch = text.match(/(?:to|బోయే|కి|కు)\s+([a-z0-9\s]+(?:station|airport|hitec|gachibowli|hills|mall|secunderabad|nampally|హైటెక్|స్టేషన్|ఎయిర్‌పోర్ట్))/i);
    if (toMatch) {
      drop = toMatch[1].trim();
    }
  }

  const explicitPickupMatch = text.match(/(?:change(?: my)? (?:pickup(?: location)?|location) to|pick(?: me)? up at|pick(?: me)? up from)\s+([a-zA-Z0-9\s]+)/i);
  if (explicitPickupMatch) {
    pickup = explicitPickupMatch[1].trim();
  } else {
    const fromMatch = text.match(/(?:from|దగ్గర|నుండి)\s+([a-z0-9\s]+(?:home|office|hills|gachibowli|banjara|హోమ్|ఇంటి))/i);
    if (fromMatch) {
      pickup = fromMatch[1].trim();
    }
  }

  if (!pickup && !drop && context._geminiHints?.entities) {
    if (context._geminiHints.entities.pickup) pickup = context._geminiHints.entities.pickup;
    if (context._geminiHints.entities.drop) drop = context._geminiHints.entities.drop;
  }

  return { pickup, drop };
}

async function updateConversationContext(conversationId: string, context: any, intent: string) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      bookingContext: JSON.stringify(context),
      currentIntent: intent
    }
  });
}

async function recordAssistantMessage(conversationId: string, content: string, toolName?: string, toolResult?: string) {
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content,
      toolName,
      toolResult
    }
  });
}

/**
 * Gemini Call Processor
 */
async function processWithGemini(conversationId: string, userId: string, message: string, lang: 'en' | 'te', context: any): Promise<ProcessAgentOutput | null> {
  if (!ai) return null;
  
  try {
    const prompt = `
      You are RideAI, a helpful, friendly humanoid AI agent for booking rides and answering questions.
      Language: ${lang === 'te' ? 'Telugu' : 'English'}
      Current Booking Context: ${JSON.stringify(context)}
      User Message: "${message}"

      Analyze the user message:
      1. Is it a GENERAL_QUESTION, greeting, chit-chat, or general knowledge question (e.g. "who are you", "do you know Modi ji", "hi", "how are you", "what can you do")?
      2. Or is it a RIDE_BOOKING intent (e.g. "book a cab", "show available cabs", "cancel ride", "where is my driver", "fare estimate")?
      
      Respond ONLY with a valid JSON object with no markdown formatting.
      Format:
      {
        "intent": "GENERAL_QUESTION" | "CREATE_BOOKING" | "UPDATE_DRAFT" | "CONFIRM_BOOKING" | "CANCEL_BOOKING" | "GET_RIDE_STATUS" | "GET_FARE_ESTIMATE" | "GET_AVAILABILITY" | "CHANGE_LANGUAGE",
        "isGeneralQuestion": boolean,
        "conversationalAnswer": "If isGeneralQuestion is true, provide a direct, helpful, friendly answer in ${lang === 'te' ? 'Telugu' : 'English'}. Otherwise null.",
        "entities": {
          "pickup": "extracted pickup location or null",
          "drop": "extracted drop location or null",
          "time": "extracted target time or null",
          "vehicleType": "SEDAN | AUTO | SUV | BIKE or null"
        }
      }
    `;
    
    const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
    });
    
    const text = response.text || "";
    // Clean JSON markdown
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    console.log('\n======================================================');
    console.log(`🤖 GEMINI AI API CALLED USING KEY: ${GEMINI_API_KEY.substring(0, 8)}...`);
    console.log(`🗣️ USER MESSAGE: "${message}"`);
    console.log(`🧠 GEMINI RAW JSON RESPONSE:`);
    console.log(jsonStr);
    console.log('======================================================\n');
    
    try {
      const parsed = JSON.parse(jsonStr);
      context._geminiHints = parsed;

      // Handle General Knowledge / Greetings directly via Gemini
      if (parsed.isGeneralQuestion || parsed.intent === 'GENERAL_QUESTION') {
        const resp = parsed.conversationalAnswer || (lang === 'te'
          ? 'నేను రైడ్AI, మీ హ్యూమనోయిడ్ ఏజెంట్‌ను! మీకు క్యాబ్ బుక్ చేయడంలో లేదా రైడ్ సంబంధిత ప్రశ్నలకు సహాయం చేయడానికి ఇక్కడ ఉన్నాను.'
          : 'I am RideAI, your humanoid AI assistant! I am here to help you with booking cabs, fare estimates, and tracking rides. How can I assist you today?');

        // Clear any stale booking draft context
        context.pickup = null;
        context.destination = null;
        context.state = 'IDLE';
        await updateConversationContext(conversationId, context, 'IDLE');

        await recordAssistantMessage(conversationId, resp, 'generalQuestion');
        return {
          conversationId,
          response: resp,
          language: lang,
          intent: 'GENERAL_QUESTION',
          bookingDraft: context
        };
      }

      return null; // Fall through for local engine tool execution using hints
    } catch (e) {
      return null;
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error?.message || error);
    throw error;
  }
}

/**
 * Strict word boundary search to avoid substring matching bugs (e.g. 'ok' inside 'booking')
 */
function containsWord(text: string, words: string[]): boolean {
  const textLower = text.toLowerCase();
  return words.some(word => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s|[^a-zA-Z0-9\u0C00-\u0C7F])${escaped}(?:$|\\s|[^a-zA-Z0-9\u0C00-\u0C7F])`, 'i');
    return regex.test(textLower);
  });
}

/**
 * Detect noise, gibberish, or special character sequences (e.g. &^**@#(@(%%%%)
 */
function isGibberishOrNoise(text: string): boolean {
  if (!text || typeof text !== 'string') return true;
  const clean = text.replace(/[^a-zA-Z0-9\u0C00-\u0C7F\s]/g, '').trim();
  if (clean.length < 2) return true;

  const symbolCount = (text.match(/[^a-zA-Z0-9\u0C00-\u0C7F\s]/g) || []).length;
  if (symbolCount / text.length > 0.4) return true;

  return false;
}

/**
 * Detect general knowledge questions, greetings, identity queries, or general chit-chat
 */
function isGeneralQueryOrGreeting(text: string): boolean {
  const textLower = text.toLowerCase().trim();

  // Greetings
  if (/^(hi|hello|hey|namaste|good morning|good afternoon|good evening|హలో|నమస్కారం|హాయ్)$/i.test(textLower)) {
    return true;
  }

  // General Knowledge / People / Modi / Chit-Chat keywords
  const generalKeywords = [
    'modi', 'prime minister', 'president', 'weather', 'joke', 'who is', 'do you know',
    'who are you', 'what is your name', 'what can you do', 'how are you', 'tell me about',
    'నువ్వు ఎవరు', 'మీ పేరు', 'మోదీ', 'సంగతులు', 'ఏంటి', 'ఎవరు'
  ];

  if (generalKeywords.some(keyword => textLower.includes(keyword))) {
    return true;
  }

  // Question pattern without any ride intent words
  const isQuestion = textLower.includes('?') || textLower.startsWith('who') || textLower.startsWith('what') || textLower.startsWith('how') || textLower.startsWith('do you');
  const hasRideKeywords = containsWord(textLower, [
    'cab', 'cabs', 'ride', 'rides', 'book', 'booking', 'fare', 'estimate', 'cost', 'price',
    'driver', 'track', 'status', 'pickup', 'drop', 'destination', 'station', 'airport', 'hitec',
    'క్యాబ్', 'రైడ్', 'బుక్', 'ఛార్జీ'
  ]);

  if (isQuestion && !hasRideKeywords) {
    return true;
  }

  return false;
}

/**
 * Generate friendly, intelligent responses for general knowledge / greetings locally
 */
function generateLocalGeneralAnswer(text: string, lang: 'en' | 'te'): string {
  const textLower = text.toLowerCase().trim();

  // Narendra Modi / Political / Entity query
  if (textLower.includes('modi') || textLower.includes('మోదీ')) {
    return lang === 'te'
      ? 'నరేంద్ర మోదీ గారు భారతదేశానికి ప్రధాని! 🇮🇳 నేను మీ రైడ్AI హ్యూమనోయిడ్ ఏజెంట్‌ను. క్యాబ్ బుకింగ్స్, ఛార్జీల వివరాలు లేదా లైవ్ డ్రైవర్ ట్రాకింగ్‌లో ఎలా సహాయపడాలి?'
      : 'Narendra Modi is the Prime Minister of India! 🇮🇳 As your AI assistant, I\'m here to help you with cab bookings, fare estimates, and tracking. How can I assist you with your travel today?';
  }

  // Greetings
  if (/^(hi|hello|hey|namaste|good morning|good afternoon|good evening|హలో|నమస్కారం|హాయ్)$/i.test(textLower)) {
    return lang === 'te'
      ? 'నమస్కారం! నేను మీ రైడ్AI హ్యూమనోయిడ్ ఏజెంట్‌ను. ఈరోజు మీరు ఎక్కడికి ప్రయాణించాలనుకుంటున్నారు?'
      : 'Hello! I am your RideAI Humanoid Agent. Where would you like to travel today?';
  }

  // Identity / Capabilities
  if (textLower.includes('who are you') || textLower.includes('what is your name') || textLower.includes('what can you do') || textLower.includes('నువ్వు ఎవరు') || textLower.includes('మీ పేరు')) {
    return lang === 'te'
      ? 'నేను రైడ్AI, మీ హ్యూమనోయిడ్ క్యాబ్ బుకింగ్ ఏజెంట్‌ను! హైదరాబాద్ పరిధిలో మీకు క్యాబ్‌లు బుక్ చేయడం, ఛార్జీల వివరాలు చెప్పడం మరియు డ్రైవర్ లైవ్ లోకేషన్ చూపించడంలో సహాయపడతాను.'
      : 'I am RideAI, your intelligent humanoid ride booking agent! I can assist you with finding nearby cabs, estimating fares, booking rides across Hyderabad, and tracking your driver in real time.';
  }

  // How are you
  if (textLower.includes('how are you') || textLower.includes('బాగున్నారా')) {
    return lang === 'te'
      ? 'నేను చాలా బాగున్నాను, ధన్యవాదాలు! 😊 మీకు ఎలాంటి క్యాబ్ సహాయం కావాలి?'
      : 'I am doing great, thank you! 😊 How can I help you with your ride today?';
  }

  // General Knowledge / Default Fallback
  return lang === 'te'
    ? 'నేను రైడ్AI హ్యూమనోయిడ్ ఏజెంట్‌ను! మీకు క్యాబ్ బుకింగ్స్, ఛార్జీలు మరియు రైడ్ ట్రాకింగ్‌లో సహాయం చేయడానికి ఇక్కడ ఉన్నాను. దయచేసి మీ ప్రయాణ ప్రదేశాన్ని చెప్పండి.'
    : 'I am RideAI, your humanoid AI assistant! I am specialized in cab bookings, fare estimates, and driver tracking. How can I help with your journey today?';
}



