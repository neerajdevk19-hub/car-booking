export interface LocaleDictionary {
  appName: string;
  tagline: string;
  nav: {
    assistant: string;
    booking: string;
    tracking: string;
    rides: string;
    driverPortal: string;
    adminDashboard: string;
    login: string;
  };
  assistant: {
    title: string;
    subtitle: string;
    placeholder: string;
    listening: string;
    speaking: string;
    processing: string;
    confirmBooking: string;
    cancelBooking: string;
    switchLangPrompt: string;
    quickPrompts: string[];
  };
  booking: {
    title: string;
    pickupLabel: string;
    dropLabel: string;
    selectVehicle: string;
    getEstimate: string;
    distance: string;
    duration: string;
    fare: string;
    confirmBtn: string;
  };
  tracking: {
    title: string;
    driverAssigned: string;
    searchingDriver: string;
    eta: string;
    status: string;
    callDriver: string;
    cancelRide: string;
  };
  driver: {
    title: string;
    statusOnline: string;
    statusOffline: string;
    incomingTrip: string;
    accept: string;
    reject: string;
    arrive: string;
    startTrip: string;
    completeTrip: string;
  };
  admin: {
    title: string;
    totalBookings: string;
    activeDrivers: string;
    revenue: string;
    aiLogs: string;
  };
}

export const LOCALES: Record<'en' | 'te', LocaleDictionary> = {
  en: {
    appName: 'RideAI Humanoid',
    tagline: 'AI-Powered Humanoid Ride Booking Engine',
    nav: {
      assistant: 'AI Assistant',
      booking: 'Book Ride',
      tracking: 'Live Tracking',
      rides: 'My Rides',
      driverPortal: 'Driver App',
      adminDashboard: 'Admin App',
      login: 'Sign In'
    },
    assistant: {
      title: 'AI Humanoid Booking Agent',
      subtitle: 'Talk naturally in English or Telugu to book, track, or modify cabs',
      placeholder: 'Type or speak naturally (e.g., "Book a cab to Secunderabad station")',
      listening: 'Listening to your voice...',
      speaking: 'AI Humanoid is speaking...',
      processing: 'Processing intent & checking cab availability...',
      confirmBooking: 'Confirm Booking',
      cancelBooking: 'Cancel Draft',
      switchLangPrompt: 'తెలుగులోకి మార్చండి (Switch to Telugu)',
      quickPrompts: [
        'Book a cab from my home to Secunderabad Station',
        'Show me available cabs nearby',
        'How much is a sedan to RGIA Airport?',
        'Where is my driver?'
      ]
    },
    booking: {
      title: 'Interactive Cab Booking & Fare Estimate',
      pickupLabel: 'Pickup Location',
      dropLabel: 'Drop-off Destination',
      selectVehicle: 'Select Vehicle Category',
      getEstimate: 'Calculate Fare & Route',
      distance: 'Distance',
      duration: 'Duration',
      fare: 'Estimated Fare',
      confirmBtn: 'Proceed to Confirmation'
    },
    tracking: {
      title: 'Live Driver GPS Tracking',
      driverAssigned: 'Driver Assigned & En Route',
      searchingDriver: 'Searching nearby available drivers...',
      eta: 'Estimated Arrival Time',
      status: 'Trip Status',
      callDriver: 'Call Driver',
      cancelRide: 'Cancel Ride'
    },
    driver: {
      title: 'RideAI Driver Portal',
      statusOnline: 'ONLINE (Receiving Trips)',
      statusOffline: 'OFFLINE',
      incomingTrip: 'New Incoming Ride Offer',
      accept: 'Accept Ride',
      reject: 'Decline',
      arrive: 'Mark Arrived at Pickup',
      startTrip: 'Start Trip Navigation',
      completeTrip: 'Complete Ride'
    },
    admin: {
      title: 'System Operations & AI Inspector',
      totalBookings: 'Total Bookings',
      activeDrivers: 'Active Drivers Online',
      revenue: 'Total Fare Revenue',
      aiLogs: 'AI Agent Action Execution Logs'
    }
  },
  te: {
    appName: 'రైడ్AI హ్యూమనోయిడ్',
    tagline: 'ఏఐ ఆధారిత హ్యూమనోయిడ్ క్యాబ్ బుకింగ్ వ్యవస్థ',
    nav: {
      assistant: 'ఏఐ అసిస్టెంట్',
      booking: 'క్యాబ్ బుక్ చేయండి',
      tracking: 'లైవ్ ట్రాకింగ్',
      rides: 'నా రైడ్‌లు',
      driverPortal: 'డ్రైవర్ యాప్',
      adminDashboard: 'అడ్మిన్ యాప్',
      login: 'లాగిన్'
    },
    assistant: {
      title: 'ఏఐ హ్యూమనోయిడ్ బుకింగ్ ఏజెంట్',
      subtitle: 'ఇంగ్లీష్ లేదా తెలుగులో సులభంగా మాట్లాడి క్యాబ్‌లు బుక్ చేసుకోండి',
      placeholder: 'తెలుగు లేదా ఇంగ్లీష్‌లో మాట్లాడండి (ఉదా: "నాకు రైల్వే స్టేషన్‌కు క్యాబ్ కావాలి")',
      listening: 'మీ మాటలను వింటున్నాను...',
      speaking: 'ఏఐ హ్యూమనోయిడ్ సమాధానం చెప్తోంది...',
      processing: 'మీ అభ్యర్థనను ప్రాసెస్ చేస్తోంది...',
      confirmBooking: 'బుకింగ్‌ను ధృవీకరించు (Confirm)',
      cancelBooking: 'రద్దు చేయి (Cancel)',
      switchLangPrompt: 'Switch to English',
      quickPrompts: [
        'నాకు బంజారా హిల్స్ నుండి సికింద్రాబాద్ రైల్వే స్టేషన్కు క్యాబ్ కావాలి',
        'సమీపంలో అందుబాటులో ఉన్న క్యాబ్‌లను చూపించు',
        'శంషాబాద్ ఎయిర్‌పోర్ట్‌కు ఛార్జీ ఎంత అవుతుంది?',
        'నా డ్రైవర్ ఎక్కడ ఉన్నాడు?'
      ]
    },
    booking: {
      title: 'క్యాబ్ బుకింగ్ మరియు ఛార్జీ అంచనా',
      pickupLabel: 'పికప్ లొకేషన్',
      dropLabel: 'డ్రాప్ లొకేషన్ (గమ్యస్థానం)',
      selectVehicle: 'వాహన రకాన్ని ఎంచుకోండి',
      getEstimate: 'ఛార్జీ & రూట్ అంచనా వేయి',
      distance: 'దూరం',
      duration: 'సమయం',
      fare: 'అంచనా ఛార్జీ',
      confirmBtn: 'బుకింగ్ ధృవీకరణకు వెళ్లు'
    },
    tracking: {
      title: 'లైవ్ డ్రైవర్ GPS ట్రాకింగ్',
      driverAssigned: 'డ్రైవర్ కేటాయించబడ్డారు',
      searchingDriver: 'సమీపంలోని డ్రైవర్ కోసం వెతుకుతోంది...',
      eta: 'రాక సమయం',
      status: 'రైడ్ స్థితి',
      callDriver: 'డ్రైవర్‌కు కాల్ చేయి',
      cancelRide: 'రైడ్ రద్దు చేయి'
    },
    driver: {
      title: 'రైడ్AI డ్రైవర్ పోర్టల్',
      statusOnline: 'ఆన్‌లైన్ (రైడ్‌లు స్వీకరించడానికి సిద్ధం)',
      statusOffline: 'ఆఫ్‌లైన్',
      incomingTrip: 'క్రొత్త రైడ్ అభ్యర్థన వచ్చింది',
      accept: 'రైడ్ అంగీకరించు',
      reject: 'తిరస్కరించు',
      arrive: 'పికప్ వద్దకు వచ్చాను',
      startTrip: 'ప్రయాణం ప్రారంభించు',
      completeTrip: 'ప్రయాణం పూర్తి చేయి'
    },
    admin: {
      title: 'సిస్టమ్ ఆపరేషన్స్ & AI ఇన్‌స్పెక్టర్',
      totalBookings: 'మొత్తం బుకింగ్‌లు',
      activeDrivers: 'ఆన్‌లైన్ డ్రైవర్లు',
      revenue: 'మొత్తం ఆదాయం',
      aiLogs: 'ఏఐ యాక్షన్ లాగ్‌లు'
    }
  }
};
