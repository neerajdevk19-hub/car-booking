const text = "Book a cab from Banjara Hills to Jubilee Hills Checkpost";

function extractPickupAndDrop(text, context = {}) {
  let pickup = null;
  let drop = null;

  if (context._geminiHints?.entities) {
    if (context._geminiHints.entities.pickup) pickup = context._geminiHints.entities.pickup;
    if (context._geminiHints.entities.drop) drop = context._geminiHints.entities.drop;
    if (pickup || drop) return { pickup, drop };
  }

  const fromToMatch = text.match(/(?:from|పికప్)\s+([^to|వరకు|కి|కు]+?)\s+(?:to|నగర్|వరకు|కి|కు)\s+(.+)/i);
  if (fromToMatch) {
    pickup = fromToMatch[1].trim();
    drop = fromToMatch[2].trim();
    return { pickup, drop };
  }

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

  return { pickup, drop };
}

console.log(extractPickupAndDrop(text));
