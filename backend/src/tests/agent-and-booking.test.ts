import { describe, it, expect, beforeAll } from 'vitest';
import { processAgentMessage } from '../ai/agent/ai-agent.service';
import { calculateFareForType } from '../modules/pricing/pricing.service';
import { findNearbyAvailableDrivers } from '../modules/assignments/assignment.service';
import { prisma } from '../prisma/client';

describe('RideAI Core Suite & AI Humanoid Agent Tests', () => {
  let demoUserId: string;

  beforeAll(async () => {
    // Retrieve demo customer from DB
    const user = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    if (user) {
      demoUserId = user.id;
    }
  });

  it('1. Calculates correct fare pricing for vehicle types', async () => {
    const sedanFare = await calculateFareForType('SEDAN', 10, 20);
    const autoFare = await calculateFareForType('AUTO', 10, 20);

    expect(sedanFare.totalFare).toBeGreaterThan(autoFare.totalFare);
    expect(sedanFare.currency).toBe('INR');
  });

  it('2. Finds nearby drivers ranked by distance', async () => {
    const drivers = await findNearbyAvailableDrivers(17.4150, 78.4350);
    expect(drivers.length).toBeGreaterThan(0);
    expect(drivers[0].distanceKm).toBeLessThanOrEqual(drivers[drivers.length - 1].distanceKm);
  });

  it('3. AI Agent understands English booking intent and prepares booking draft summary', async () => {
    const res = await processAgentMessage({
      userId: demoUserId,
      message: 'I want to book a cab from Banjara Hills to Secunderabad Station',
      language: 'en'
    });

    expect(['CREATE_BOOKING', 'CONFIRM_BOOKING']).toContain(res.intent);
    expect(res.response).toContain('Banjara Hills');
    expect(res.response).toContain('Secunderabad');
    expect(res.language).toBe('en');
  }, 90000);

  it('4. AI Agent remembers context and updates drop-off location', async () => {
    const step1 = await processAgentMessage({
      userId: demoUserId,
      message: 'Book a cab from my home',
      language: 'en'
    });

    const step2 = await processAgentMessage({
      userId: demoUserId,
      conversationId: step1.conversationId,
      message: 'To Secunderabad Railway Station',
      language: 'en'
    });

    expect(['UPDATE_DRAFT', 'CONFIRM_BOOKING']).toContain(step2.intent);
    expect(step2.response).toContain('Secunderabad');
  }, 90000);

  it('5. AI Agent supports Telugu language input & responses', async () => {
    const res = await processAgentMessage({
      userId: demoUserId,
      message: 'నాకు బంజారా హిల్స్ నుండి సికింద్రాబాద్ రైల్వే స్టేషన్కు క్యాబ్ కావాలి',
      language: 'te'
    });

    expect(res.language).toBe('te');
    expect(res.response).toMatch(/[\u0C00-\u0C7F]/); // Matches any Telugu character
  }, 90000);

  it('6. AI Agent handles language switching seamlessly', async () => {
    const res = await processAgentMessage({
      userId: demoUserId,
      message: 'Switch to Telugu',
      language: 'en'
    });

    expect(res.language).toBe('te');
    expect(res.response).toContain('తెలుగులో');
  }, 90000);

  it('7. AI Agent handles ride status query', async () => {
    const res = await processAgentMessage({
      userId: demoUserId,
      message: 'Where is my driver?',
      language: 'en'
    });

    expect(res.intent).toBe('GET_RIDE_STATUS');
    expect(res.response).toBeDefined();
  }, 90000);
});
