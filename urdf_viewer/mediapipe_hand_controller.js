// mediapipe_hand_controller.js

import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";

// ADD 'export' here
export class MediaPipeHandController { // <--- THIS IS THE CRITICAL CHANGE
    constructor(viewerInstance, videoElement, modelPath) {
        this.viewer = viewerInstance;
        this.video = videoElement;
        this.modelPath = modelPath;
        this.handLandmarker = null;
        this.runningMode = "VIDEO"; // For live stream processing
        this.lastVideoTime = -1;

        this.initMediaPipe();
    }

    async initMediaPipe() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: './mediapipe_models/hand_landmarker.task', // Path to your model
                delegate: "GPU" // or "CPU"
            },
            numHands: 1, // Or 2 if you want to track both hands
            runningMode: this.runningMode
        });
        console.log("MediaPipe HandLandmarker initialized.");

        this.setupWebcam();
    }

    setupWebcam() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then((stream) => {
                    this.video.srcObject = stream;
                    this.video.addEventListener("loadeddata", this.startDetectionLoop.bind(this));
                })
                .catch((error) => {
                    console.error("Error accessing webcam:", error);
                    // Update your viewer's status div with an error message
                    this.viewer.updateStatus("Error accessing webcam: " + error.message, 'error');
                });
        } else {
            this.viewer.updateStatus("Webcam not supported by this browser.", 'error');
        }
    }

    startDetectionLoop() {
        console.log("Webcam stream started. Starting hand detection loop.");
        this.video.play();
        this.detectHandsInRealTime();
    }

    detectHandsInRealTime() {
        if (this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            this.handLandmarker.detectForVideo(this.video, (result) => {
                if (result.landmarks && result.landmarks.length > 0) {
                    // console.log("Hand landmarks:", result.landmarks[0]); // Debugging
                    this.mapLandmarksToRobot(result.landmarks[0]); // Assuming one hand for now
                }
            });
        }
        requestAnimationFrame(this.detectHandsInRealTime.bind(this));
    }

    mapLandmarksToRobot(handLandmarks) {
        // --- THIS IS THE CRITICAL MAPPING LOGIC ---
        // This is where you'll write the code to convert MediaPipe's
        // 21 hand landmarks into the specific joint angles for your Allegro Hand URDF.
        // You'll need to calculate angles between landmark points and apply them
        // to this.viewer.joints (e.g., this.viewer.joints['allegro_joint_name'].rotation.x = angleInRadians;)

        // Example: (Highly simplified and illustrative, needs detailed implementation)
        // Let's say you want to control a finger joint based on the angle between two points
        // const fingerTip = handLandmarks[8]; // Example: Index finger tip
        // const fingerKnuckle = handLandmarks[5]; // Example: Index finger MCP joint
        //
        // You would calculate vectors and then the angle.
        // For example, to make a finger curl:
        // const angle = calculateCurlAngle(fingerKnuckle, handLandmarks[6], handLandmarks[7], handLandmarks[8]);
        // if (this.viewer.joints['index_finger_joint_1']) {
        //     this.viewer.joints['index_finger_joint_1'].rotation.y = angle; // Adjust axis (x,y,z) and angle
        // }
        // ------------------------------------------

        // You will call this.viewer.renderer.render(this.viewer.scene, this.viewer.camera);
        // if your animate loop doesn't handle the render implicitly based on joint changes.
    }
}