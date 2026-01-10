// import { useState, useEffect } from 'react';
// import { Accelerometer } from 'expo-sensors';

// export const useAccelerometer = (updateInterval = 100) => {
//     const [data, setData] = useState({ x: 0, y: 0, z: 0 });

//     useEffect(() => {
//         Accelerometer.setUpdateInterval(updateInterval);
//         const subscription = Accelerometer.addListener(setData);

//         return () => subscription.remove();
//     }, [updateInterval]);

//     return data;
// };