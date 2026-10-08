import { rankRoutes, generateRouteExplanation, evaluateTrafficChange, RouteOption } from './src/modules/routing/route.service';

const testCase1 = [
  { id: 'Route A', name: 'Route A', distanceKm: 10, etaMinutes: 35, trafficLevel: 'HIGH', congestion: 80 } as RouteOption,
  { id: 'Route B', name: 'Route B', distanceKm: 13, etaMinutes: 22, trafficLevel: 'LOW', congestion: 20 } as RouteOption,
];

const testCase2 = [
  { id: 'Route A', name: 'Route A', distanceKm: 8, etaMinutes: 15, trafficLevel: 'LOW', congestion: 20 } as RouteOption,
  { id: 'Route B', name: 'Route B', distanceKm: 12, etaMinutes: 25, trafficLevel: 'MEDIUM', congestion: 50 } as RouteOption,
];

const testCase3 = [
  { id: 'Route A', name: 'Route A', distanceKm: 10, etaMinutes: 20, trafficLevel: 'LOW', congestion: 20 } as RouteOption,
  { id: 'Route B', name: 'Route B', distanceKm: 8, etaMinutes: 45, trafficLevel: 'VERY HIGH', congestion: 95 } as RouteOption,
];

console.log('--- TEST CASE 1: Shortest route is NOT best ---');
let ranked1 = rankRoutes(testCase1);
console.log('Selected:', ranked1[0].id); // Expected: Route B
console.log('Explanation:', generateRouteExplanation(ranked1, 'en'));

console.log('\n--- TEST CASE 2: Shortest route IS best ---');
let ranked2 = rankRoutes(testCase2);
console.log('Selected:', ranked2[0].id); // Expected: Route A
console.log('Explanation:', generateRouteExplanation(ranked2, 'en'));

console.log('\n--- TEST CASE 3: Heavy congestion ---');
let ranked3 = rankRoutes(testCase3);
console.log('Selected:', ranked3[0].id); // Expected: Route A
console.log('Explanation:', generateRouteExplanation(ranked3, 'en'));

console.log('\n--- TEST CASE 4: Alternate route ---');
const currentRouteTC4 = { id: 'Current Route', name: 'Current Route', distanceKm: 10, etaMinutes: 45, trafficLevel: 'HIGH', congestion: 80 } as RouteOption;
const alternateRoutesTC4 = [
  { id: 'Alternative Route', name: 'Alternative Route', distanceKm: 12, etaMinutes: 27, trafficLevel: 'LOW', congestion: 20 } as RouteOption
];
const resultTC4 = evaluateTrafficChange(currentRouteTC4, alternateRoutesTC4, 'en');
console.log('Should Switch:', resultTC4.shouldSwitch); // Expected: true
console.log('Message:', resultTC4.message); // Expected: Traffic has increased...

console.log('\n--- TEST CASE 5: Traffic changes but alternate isn\'t better ---');
const currentRouteTC5 = { id: 'Current Route', name: 'Current Route', distanceKm: 10, etaMinutes: 25, trafficLevel: 'MEDIUM', congestion: 50 } as RouteOption;
const alternateRoutesTC5 = [
  { id: 'Alternative Route', name: 'Alternative Route', distanceKm: 12, etaMinutes: 24, trafficLevel: 'LOW', congestion: 20 } as RouteOption
];
const resultTC5 = evaluateTrafficChange(currentRouteTC5, alternateRoutesTC5, 'en');
console.log('Should Switch:', resultTC5.shouldSwitch); // Expected: false
console.log('Message:', resultTC5.message);
