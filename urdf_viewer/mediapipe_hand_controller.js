import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";

export class MediaPipeHandController {
    constructor(viewerInstance, videoElement) {
        this.viewer = viewerInstance;
        this.video = videoElement;
        this.handLandmarker = null;
        this.runningMode = "VIDEO";
        this.lastVideoTime = -1;
        this.webcamInitialized = false;

        this.initMediaPipe();
    }

    async initMediaPipe() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: './mediapipe_models/hand_landmarker.task',  // Fully hardcoded path
                delegate: "CPU"
            },
            numHands: 1,
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
                    this.video.addEventListener("canplay", () => {
                        this.video.play();


                        
                        this.overlayCanvas = document.getElementById("overlay");
                        this.overlayCanvas.width = this.video.videoWidth;
                        this.overlayCanvas.height = this.video.videoHeight;
                        this.overlayCtx = this.overlayCanvas.getContext("2d");



                        this.webcamInitialized = true;
                        console.log("Webcam stream started. Starting hand detection loop.");
                        this.detectHandsInRealTime();
                    }, { once: true });
                })
                .catch((error) => {
                    console.error("Error accessing webcam:", error);
                    this.viewer.updateStatus("Error accessing webcam: " + error.message, 'error');
                });
        } else {
            this.viewer.updateStatus("Webcam not supported by this browser.", 'error');
        }
    }

    async detectHandsInRealTime() {
        if (this.webcamInitialized && this.handLandmarker) {
            let startTimeMs = Math.round(performance.now() * 1000);

            if (this.video.currentTime !== this.lastVideoTime) {
                this.lastVideoTime = this.video.currentTime;
                
                try {
                    const result = await this.handLandmarker.detectForVideo(this.video, startTimeMs);
                    if (result.landmarks && result.landmarks.length > 0) {
                        this.mapLandmarksToRobot(result.landmarks[0]);
                        this.drawLandmarks(result.landmarks[0]);
                    }
                } catch (error) {
                    console.error("Hand detection error:", error);
                }
            }
        }
        requestAnimationFrame(this.detectHandsInRealTime.bind(this));
    }


    drawLandmarks(landmarks) {
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        this.overlayCtx.fillStyle = 'red';
        for (let i = 0; i < landmarks.length; i++) {
            const x = landmarks[i].x * this.overlayCanvas.width;
            const y = landmarks[i].y * this.overlayCanvas.height;
            this.overlayCtx.beginPath();
            this.overlayCtx.arc(x, y, 5, 0, 2 * Math.PI);
            this.overlayCtx.fill();
        }
    }

    mapLandmarksToRobot(handLandmarks) {
        // Your logic for converting landmarks to URDF joint angles
    }
}
