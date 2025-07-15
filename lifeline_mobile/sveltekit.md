Svelte Native - a mobile framework that uses Svelte for UI and NativeScripts under the hood for device access

What is Svelte?
is a radical new approach to building user interfaces. Whereas traditional frameworks like React and Vue do the bulk of their work in the browser, Svelte shifts that work into a compile step that happens when you build your app.

Instead of using techniques like virtual DOM diffing, Svelte writes code that surgically updates the DOM when the state of your app changes.


What is NativeScript?
is an open-source framework to develop apps on the Apple iOS and Android platforms. 

Since it runs on NativeScript, we get access to native APIs like:
GPS / Location
Accelerometer
Gyroscope 
https://www.npmjs.com/package/nativescript-android-sensors
Microphone
Camera
SMS / Notification
Network and Bluetooth

* Environment Support
Widgets / UI Components
Based on NativeScript Core Components (not HTML).

Includes:
Labels, Buttons, ListViews
StackLayouts, Grids, TabViews
Modal dialogs, Toasts
We can also use custom native components (via NativeScript plugins or by writing native code and wrapping it).

* Cross-platform Compatibility
Target platforms: Android and iOS
UI layouts and native APIs adjust per platform via NativeScript.

* Reactivity
Svelte’s reactivity is built into the language — no virtual DOM.
Changes to data are immediately reflected in the UI with very little code.

* Performance
Fast UI updates thanks to Svelte's compiled reactivity.
Uses native UI components, not web views — so smoother animations and better battery life vs. hybrid apps like Cordova.
Lighter bundle size compared to React Native or Flutter.
