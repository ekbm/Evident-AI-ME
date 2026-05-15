interface GeoLocation {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
}

export async function getLocationFromIP(ip: string): Promise<GeoLocation> {
  const emptyResult: GeoLocation = {
    country: null,
    countryCode: null,
    city: null,
    region: null,
    timezone: null,
  };

  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return emptyResult;
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,timezone`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.log(`[Geolocation] API returned ${response.status} for IP: ${ip}`);
      return emptyResult;
    }

    const data = await response.json();

    if (data.status !== "success") {
      console.log(`[Geolocation] Failed lookup for IP: ${ip}`);
      return emptyResult;
    }

    return {
      country: data.country || null,
      countryCode: data.countryCode || null,
      city: data.city || null,
      region: data.regionName || null,
      timezone: data.timezone || null,
    };
  } catch (error) {
    console.log(`[Geolocation] Error looking up IP ${ip}:`, error);
    return emptyResult;
  }
}

export function getClientIP(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = forwarded.split(",");
    return ips[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "";
}
