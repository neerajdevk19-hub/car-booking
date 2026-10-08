export interface RouteOption {
  id: string;
  name: string;
  distanceKm: number;
  etaMinutes: number;
  trafficLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH';
  congestion: number; // 0 to 100
}

/**
 * Ranks a list of routes based on ETA, Congestion, and Distance.
 * Lower score is better.
 */
export function rankRoutes(routes: RouteOption[]): RouteOption[] {
  return [...routes].sort((a, b) => {
    // 1. Prefer lower ETA heavily (1 ETA min = 1 point)
    // 2. Penalize congestion (10 congestion = 0.5 point)
    // 3. Penalize distance (1 km = 0.2 point)
    const scoreA = a.etaMinutes + (a.congestion * 0.05) + (a.distanceKm * 0.2);
    const scoreB = b.etaMinutes + (b.congestion * 0.05) + (b.distanceKm * 0.2);
    
    return scoreA - scoreB;
  });
}

/**
 * Generates mock routes based on distance to simulate real-world route API
 */
export function generateMockRoutes(baseDistanceKm: number): RouteOption[] {
  const baseEta = baseDistanceKm * 2.5; // roughly 24 km/h

  return [
    {
      id: 'route_1',
      name: 'Main Highway',
      distanceKm: baseDistanceKm,
      etaMinutes: Math.round(baseEta * 1.5), // highly congested
      trafficLevel: 'HIGH',
      congestion: 80
    },
    {
      id: 'route_2',
      name: 'Bypass Road',
      distanceKm: Number((baseDistanceKm * 1.3).toFixed(1)), // longer
      etaMinutes: Math.round(baseEta * 1.1), // faster
      trafficLevel: 'LOW',
      congestion: 25
    },
    {
      id: 'route_3',
      name: 'City Center',
      distanceKm: Number((baseDistanceKm * 0.9).toFixed(1)), // shortest
      etaMinutes: Math.round(baseEta * 1.8), // extremely congested
      trafficLevel: 'VERY HIGH',
      congestion: 95
    }
  ];
}

/**
 * AI Explanation generator based on the winning route vs the shortest route
 */
export function generateRouteExplanation(rankedRoutes: RouteOption[], language: 'en' | 'te' = 'en'): string {
  const best = rankedRoutes[0];
  const shortest = [...rankedRoutes].sort((a, b) => a.distanceKm - b.distanceKm)[0];

  if (best.id === shortest.id) {
    return language === 'te' 
      ? `నేను ${best.name}ని సూచిస్తున్నాను. ఇది అత్యంత వేగవంతమైనది మరియు తక్కువ దూరం (${best.distanceKm} కి.మీ, ${best.etaMinutes} నిమిషాలు).`
      : `I recommend the ${best.name} route. It is both the fastest and the shortest (${best.distanceKm} km, ${best.etaMinutes} mins).`;
  }

  const timeSaved = shortest.etaMinutes - best.etaMinutes;
  
  if (best.etaMinutes < shortest.etaMinutes && best.trafficLevel === 'LOW' && shortest.trafficLevel !== 'LOW') {
    return language === 'te'
      ? `నేను ${best.name}ని సూచిస్తున్నాను. ఇది కొద్దిగా పొడవైనప్పటికీ, ట్రాఫిక్ తక్కువగా ఉంది మరియు దాదాపు ${timeSaved} నిమిషాలు ముందుగా చేరుకోవచ్చు.`
      : `I recommend the ${best.name} route. It is slightly longer, but current traffic is lighter and the estimated travel time is about ${timeSaved} minutes faster compared to the shortest route.`;
  }

  return language === 'te'
    ? `నేను ${best.name}ని సూచిస్తున్నాను. ఇది ${best.etaMinutes} నిమిషాల్లో మిమ్మల్ని తీసుకువెళుతుంది.`
    : `I recommend the ${best.name} route. It will get you there in about ${best.etaMinutes} minutes.`;
}

/**
 * Evaluates if an alternate route is significantly better due to traffic changes
 */
export function evaluateTrafficChange(
  currentRoute: RouteOption,
  alternateRoutes: RouteOption[],
  language: 'en' | 'te' = 'en'
): { shouldSwitch: boolean; message: string; alternate?: RouteOption } {
  const rankedAlternates = rankRoutes(alternateRoutes);
  const bestAlternate = rankedAlternates[0];

  // If alternate saves more than 10% of time or >5 mins and avoids heavy traffic
  if (
    currentRoute.etaMinutes - bestAlternate.etaMinutes >= 5 || 
    (currentRoute.trafficLevel === 'HIGH' && bestAlternate.trafficLevel === 'LOW' && currentRoute.etaMinutes > bestAlternate.etaMinutes)
  ) {
    const timeSaved = currentRoute.etaMinutes - bestAlternate.etaMinutes;
    const msg = language === 'te'
      ? `మీ ప్రస్తుత మార్గంలో ట్రాఫిక్ పెరిగింది. నేను దాదాపు ${timeSaved} నిమిషాలు ఆదా చేయగల ప్రత్యామ్నాయ మార్గాన్ని కనుగొన్నాను. నేను ఆ మార్గానికి మారమంటారా?`
      : `Traffic has increased on your current route. I found an alternate route that may save approximately ${timeSaved} minutes. Would you like me to switch?`;
    
    return { shouldSwitch: true, message: msg, alternate: bestAlternate };
  }

  return { shouldSwitch: false, message: '' };
}
