
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

export const getCurrentLocation = async (): Promise<GeolocationPosition> => {
    const getLocation = (highAccuracy: boolean, timeout: number): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                return reject(new Error("Geolocation is not supported by your browser."));
            }
            
            // Set a very generous safety timeout (2 minutes)
            // This is mainly to prevent the app from hanging forever if the browser doesn't respond
            // Note: The built-in 'timeout' option only starts AFTER the user grants permission.
            const safetyTimeout = setTimeout(() => {
                reject(new Error("Location request timed out. Please ensure you have granted permission and have a clear view of the sky or a strong Wi-Fi signal."));
            }, 120000);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    clearTimeout(safetyTimeout);
                    resolve(pos);
                },
                (err) => {
                    clearTimeout(safetyTimeout);
                    reject(err);
                },
                {
                    enableHighAccuracy: highAccuracy,
                    timeout: timeout, 
                    maximumAge: highAccuracy ? 0 : 60000 // Force fresh for high accuracy, allow 1m old for low
                }
            );
        });
    };

    try {
        // Attempt 1: High accuracy, fresh
        return await getLocation(true, 20000);
    } catch (e: any) {
        // If permission was denied, don't bother retrying
        if (e.code === 1) {
            const err = new Error("Location access was denied. Please check your browser settings and allow location access for this site.");
            (err as any).code = 1;
            throw err;
        }
        
        // Fallback to low accuracy
        try {
            return await getLocation(false, 20000);
        } catch (e2: any) {
            if (e2.code === 1) throw e2;
            
            // Final attempt: allow any cached position, very long timeout
            try {
                return await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false,
                        timeout: 30000,
                        maximumAge: Infinity
                    });
                });
            } catch (e3: any) {
                const finalErr = new Error("Could not determine location after multiple attempts. Please ensure you are in an area with good signal or enter coordinates manually.");
                (finalErr as any).code = e3.code || 0;
                throw finalErr;
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
    radiusMeters: number = 500
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
                    message = "The request to get your location timed out. Please try again in a more open area.";
                    break;
            }
        } else if (error.message) {
            message = error.message;
        }
        throw new Error(message);
    }
};
