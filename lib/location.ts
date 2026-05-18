
/**
 * Calculates the distance between two points in meters using the Haversine formula.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
};

// Application-level cache for last successful location to handle browser throttling/service hang on subsequent calls
let lastSuccessfulPosition: GeolocationPosition | null = null;
let lastFetchTime: number = 0;
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export const getCurrentLocation = async (): Promise<GeolocationPosition> => {
    // If we have a very fresh application-level cache (less than 30s), use it immediately
    // This dramatically speeds up consecutive calls and avoids browser throttling
    if (lastSuccessfulPosition && (Date.now() - lastFetchTime < 30000)) {
        console.log("Using fresh application-level location cache (less than 30s old)");
        return lastSuccessfulPosition;
    }

    const getLocation = (highAccuracy: boolean, timeout: number, maxAge: number): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                return reject(new Error("Geolocation is not supported by your browser."));
            }
            
            // Set a safety timeout that is slightly longer than the requested timeout
            // This is mainly to prevent the app from hanging forever if the browser doesn't respond
            const safetyTimeout = setTimeout(() => {
                reject(new Error("Location request timed out at the application level."));
            }, timeout + 5000);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    clearTimeout(safetyTimeout);
                    // Update application cache
                    lastSuccessfulPosition = pos;
                    lastFetchTime = Date.now();
                    resolve(pos);
                },
                (err) => {
                    clearTimeout(safetyTimeout);
                    // Standard GeolocationPositionError properties are not enumerable
                    const errorDetails = {
                        code: err.code,
                        message: err.message,
                        PERMISSION_DENIED: err.code === 1,
                        POSITION_UNAVAILABLE: err.code === 2,
                        TIMEOUT: err.code === 3
                    };
                    console.warn(`Geolocation attempt failed (High Accuracy: ${highAccuracy}):`, errorDetails);
                    reject(err);
                },
                {
                    enableHighAccuracy: highAccuracy,
                    timeout: timeout, 
                    maximumAge: maxAge
                }
            );
        });
    };

    try {
        // Attempt 1: High accuracy, allow up to 5-minute cache for speed and reliability
        console.log("Location Attempt 1: High accuracy (5-minute cache allowed)");
        return await getLocation(true, 15000, 300000); // 15s timeout, 5m cache
    } catch (e: any) {
        if (e.code === 1) { // PERMISSION_DENIED
            const err = new Error("Location access was denied. Please check your browser settings and allow location access for this site.");
            (err as any).code = 1;
            throw err;
        }
        
        console.warn("Location Attempt 1 failed, trying Attempt 2: Fresh high accuracy scan");

        // Attempt 2: High accuracy, fresh (10s cache)
        try {
            console.log("Location Attempt 2: High accuracy (10s cache)");
            return await getLocation(true, 30000, 10000); // 30s timeout, 10s cache
        } catch (e_fresh: any) {
            console.warn("Location Attempt 2 failed, trying Attempt 3: Low accuracy fresh");

            // Attempt 3: Low accuracy but fresh
            try {
                console.log("Location Attempt 3: Low accuracy (Fresh scan)");
                return await getLocation(false, 20000, 0); // 20s timeout, 0 cache
            } catch (e2: any) {
                if (e2.code === 1) throw e2;
                
                console.warn("Location Attempt 3 failed, trying Attempt 4: ANY cached position");

                // Final attempt: allow any cached position from any time
                try {
                    console.log("Location Attempt 4: Any cached position (Infinity)");
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: false,
                            timeout: 10000, // Short timeout for final attempt
                            maximumAge: Infinity // Use any cached position
                        });
                    });
                    
                    // Update application cache if successful
                    lastSuccessfulPosition = pos;
                    lastFetchTime = Date.now();
                    return pos;
                } catch (e3: any) {
                    // Final safety net: if we have a successful fetch from the last 15 minutes, use it
                    if (lastSuccessfulPosition && (Date.now() - lastFetchTime < 900000)) { // 15 minutes
                        console.warn("All new location attempts failed, but found a valid application cache (less than 15m old). Using it.");
                        return lastSuccessfulPosition;
                    }

                    const errorDetails = {
                        code: e3?.code,
                        message: e3?.message,
                        errorType: e3?.constructor?.name
                    };
                    console.error("All location attempts failed. Final error details:", errorDetails);
                    
                    const finalErr = new Error("Could not determine location. This usually happens due to poor GPS signal indoors or location being disabled on your device. Please try refreshing the page.");
                    (finalErr as any).code = e3?.code || 0;
                    throw finalErr;
                }
            }
        }
    }
};

/**
 * Verifies if the user is within a certain radius of a target location.
 * @returns A promise that resolves to true if within radius, or throws an error with a descriptive message.
 */
export const verifyLocation = async (
    targetLat: number, 
    targetLon: number, 
    radiusMeters: number = 2000
): Promise<boolean> => {
    try {
        const position = await getCurrentLocation();

        const distance = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            targetLat,
            targetLon
        );

        if (distance <= radiusMeters) {
            return true;
        } else {
            throw new Error(`You are too far from the school (${Math.round(distance)}m away). You must be within ${radiusMeters}m to perform this action.`);
        }
    } catch (error: any) {
        let message = "Could not determine your location.";
        if (error.code !== undefined) {
            switch (error.code) {
                case 1: // PERMISSION_DENIED
                    message = "Location access was denied. Please enable location permissions in your browser to proceed.";
                    break;
                case 2: // POSITION_UNAVAILABLE
                    message = "Location information is unavailable. Please ensure your device's location services (GPS) are turned on.";
                    break;
                case 3: // TIMEOUT
                    message = "The request to get your location timed out. This often happens due to weak GPS signal or being indoors. Please try moving slightly, ensure your GPS is ON, and try once more.";
                    break;
            }
        } else if (error.message) {
            message = error.message;
        }
        throw new Error(message);
    }
};
