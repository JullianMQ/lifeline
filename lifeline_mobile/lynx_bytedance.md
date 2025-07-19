# Lynx Framework
## Performance 
- Uses dual-thread architecture for rendering/events, and background thread for logic
- Instant First‑Frame Rendering (<200 ms vs React Native’s 300–500 ms)
- Benchmarks show ~40% faster cold start and ~30% lower memory usage compared to React Native

## Reactivity
- Reactivity is ran through the main UI thread (the part of the device that handles animations and gestures), unlike React Native which runs on a separate thread which adds delay.
- Decoupled rendering, UI and logic are not tied together


## Cross-Platform Compatibility
- Enables rendering via Lynx Views embedded in native apps (FOR IOS ONLY BINARY IS AVAILABLE)
- Shared codebase for different platforms only for UI. Features such as cameras, microphones, and other sensors are handled through "Native Modules", which means that they need to be implemented individually for each platform.

## Environment Support
- Supports markup tags like \<view>, \<text>, \<image> that map to native components
- True CSS support for animations, gradients, selectors, transitions
- Deployment is done through Rspeedy (rust-based) for fast bundling and hot-reload

## Native APIs Available
- Official out‑of‑the‑box support for hardware (camera, gyroscope, GPS, mic) isn’t listed.
- To use camera, accelerometer, gyroscope, GPS, or microphone, you must create custom native modules:
  - Write native code in Swift (iOS), Kotlin/Java (Android) to access the hardware.
  - Define a bridge (module) that exposes the API to Lynx/JavaScript.
  - Integrate this module when building your app.
