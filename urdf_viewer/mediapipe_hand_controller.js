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
                        // Add this line to log the landmarks to the console
                        console.log("Hand Landmarks:", result.landmarks[0]);
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
        
        // Save the current state of the canvas
        this.overlayCtx.save();
        
        // Flip the canvas horizontally to un-mirror the drawing
        this.overlayCtx.translate(this.overlayCanvas.width, 0);
        this.overlayCtx.scale(-1, 1);

        const scaleX = this.overlayCanvas.width;
        const scaleY = this.overlayCanvas.height;

        // Define connections for the hand skeleton
        const connections = [
            // Thumb
            [0, 1], [1, 2], [2, 3], [3, 4],
            // Index finger
            [0, 5], [5, 6], [6, 7], [7, 8],
            // Middle finger
            [9, 10], [10, 11], [11, 12],
            // Ring finger
            [13, 14], [14, 15], [15, 16],
            // Pinky finger
            [0, 17], [17, 18], [18, 19], [19, 20],
            // Palm base
            [0, 1], [0, 5], [5, 9], [9, 13], [13, 17]
        ];

        // Draw connections (skeleton)
        this.overlayCtx.strokeStyle = '#33aaff'; // A vibrant blue for lines
        this.overlayCtx.lineWidth = 5; // Increased line width for connections
        for (const connection of connections) {
            const start = landmarks[connection[0]];
            const end = landmarks[connection[1]];
            
            if (start && end) {
                this.overlayCtx.beginPath();
                this.overlayCtx.moveTo(start.x * scaleX, start.y * scaleY);
                this.overlayCtx.lineTo(end.x * scaleX, end.y * scaleY);
                this.overlayCtx.stroke();
            }
        }

        // Draw landmarks (points)
        this.overlayCtx.fillStyle = '#FF4136'; // Red for landmarks
        this.overlayCtx.strokeStyle = '#FFFFFF'; // White border
        this.overlayCtx.lineWidth = 2; // Increased line width for landmark borders
        for (let i = 0; i < landmarks.length; i++) {
            const x = landmarks[i].x * scaleX;
            const y = landmarks[i].y * scaleY;
            
            this.overlayCtx.beginPath();
            this.overlayCtx.arc(x, y, 7, 0, 2 * Math.PI); // Increased radius for landmarks
            this.overlayCtx.fill();
            this.overlayCtx.stroke(); // Draw border
        }

        // Optional: Color code different parts of the hand
        const fingerColors = [
            '#FF851B', // Orange for Thumb (landmarks 1-4)
            '#2ECC40', // Green for Index (landmarks 5-8)
            '#FFDC00', // Yellow for Middle (landmarks 9-12)
            '#7FDBFF', // Light Blue for Ring (landmarks 13-16)
            '#B10DC9'  // Purple for Pinky (landmarks 17-20)
        ];

        const fingerLandmarkIndices = [
            [1, 2, 3, 4],    // Thumb
            [5, 6, 7, 8],    // Index
            [9, 10, 11, 12], // Middle
            [13, 14, 15, 16],// Ring
            [17, 18, 19, 20] // Pinky
        ];

        for (let f = 0; f < fingerLandmarkIndices.length; f++) {
            this.overlayCtx.fillStyle = fingerColors[f];
            for (const index of fingerLandmarkIndices[f]) {
                const x = landmarks[index].x * scaleX;
                const y = landmarks[index].y * scaleY;
                this.overlayCtx.beginPath();
                this.overlayCtx.arc(x, y, 7, 0, 2 * Math.PI);
                this.overlayCtx.fill();
                this.overlayCtx.stroke();
            }
        }

        // Base of the hand/palm (landmark 0) - often useful to highlight
        this.overlayCtx.fillStyle = '#F012BE'; // Pink for the palm base
        this.overlayCtx.beginPath();
        this.overlayCtx.arc(landmarks[0].x * scaleX, landmarks[0].y * scaleY, 10, 0, 2 * Math.PI);
        this.overlayCtx.fill();
        this.overlayCtx.stroke();

        // Restore the canvas state
        this.overlayCtx.restore();
    }

    mapLandmarksToRobot(handLandmarks) {
        // Your logic for converting landmarks to URDF joint angles
    }
}