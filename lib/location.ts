
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

/**
 * Verifies if the user is within a certain radius of a target location.
 * @returns A promise that resolves to true if within radius, or throws an error with a descriptive message.
 */
export const verifyLocation = async (
    targetLat: number, 
    targetLon: number, 
    radiusMeters: number = 500
): Promise<boolean> => {
    const getLocation = (highAccuracy: boolean): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                return reject(new Error("Geolocation is not supported by your browser."));
            }
            // Increase timeouts and allow older cached positions to improve success rate
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: highAccuracy,
                timeout: highAccuracy ? 15000 : 20000, 
                maximumAge: 300000 // Allow 5 minute old cached position
            });
        });
    };

    try {
        // Try with high accuracy first
        let position: GeolocationPosition;
        try {
            position = await getLocation(true);
        } catch (e: any) {
            // If permission was denied, don't bother retrying
            if (e.code === 1) throw e;
            
            // Fallback to low accuracy for other errors (timeout, unavailable)
            try {
                position = await getLocation(false);
            } catch (e2: any) {
                // If even low accuracy fails, try one last time with a very long timeout
                // and allowing any cached position
                if (e2.code === 1) throw e2;
                
                return new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            const dist = calculateDistance(
                                pos.coords.latitude,
                                pos.coords.longitude,
                                targetLat,
                                targetLon
                            );
                            if (dist <= radiusMeters) {
                                resolve(true);
                            } else {
                                reject(new Error(`You are too far from the school (${Math.round(dist)}m away). You must be within ${radiusMeters}m to perform this action.`));
                            }
                        }, 
                        () => reject(e2), 
                        {
                            enableHighAccuracy: false,
                            timeout: 30000,
                            maximumAge: Infinity
                        }
                    );
                });
            }
        }

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
                case error.PERMISSION_DENIED:
                    message = "Location access was denied. Please enable location permissions in your browser to proceed.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = "Location information is unavailable. Please ensure your device's location services (GPS) are turned on.";
                    break;
                case error.TIMEOUT:
                    message = "The request to get your location timed out. Please try again in a more open area.";
                    break;
            }
        } else if (error.message) {
            message = error.message;
        }
        throw new Error(message);
    }
};
