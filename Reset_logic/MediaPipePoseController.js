import {
    PoseLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

export class MediaPipePoseController {
    constructor(viewerInstance, videoElement) {
        this.viewer = viewerInstance;
        this.video = videoElement;
        this.poseLandmarker = null;
        this.runningMode = "VIDEO";
        this.lastVideoTime = -1;
        this.webcamInitialized = false;

        // Human-friendly joint names mapped to actual URDF joint names from TOCABI.js
        this.jointMap = {
            // Legs (assuming pitch for hip flexion/extension and knee flexion/extension)
            r_hip_pitch: "Revolute100", // Right Hip Front/Back (URDF Y-axis)
            r_knee: "Revolute102", // Right Knee Front/Back (URDF X-axis, typically pitch)
            l_hip_pitch: "Revolute74", // Left Hip Front/Back (URDF Y-axis)
            l_knee: "Revolute104", // Left Knee Front/Back (URDF X-axis, typically pitch)

            // Arms (assuming pitch for shoulder flexion/extension, elbow flexion/extension)
            r_shoulder_pitch: "Revolute54", // Right Shoulder Front/Back (URDF Z-axis, but user implies pitch)
            r_elbow: "Revolute89", // Right Elbow Bend (URDF Y-axis)
            l_shoulder_pitch: "Revolute90", // Left Shoulder Front/Back (URDF Z-axis, but user implies pitch)
            l_elbow: "Revolute91", // Left Elbow Bend (URDF Y-axis)

            // Torso & Neck
            spine_pitch: "Revolute51", // Upper Body Up/Down (URDF Y-axis, consistent with pitch)
            neck_pitch: "Revolute72", // Neck Front/Back (URDF Y-axis, assuming pitch, NOT user's "left right")

            // Added Roll/Yaw joints based on URDF and user's descriptions, with approximate calculations
            l_forearm_roll: "Revolute116", // Left below elbow rotate left right (URDF Z-axis)
            l_wrist_roll: "Revolute118", // Left palm left right (URDF X-axis)
            // Add other joints as needed, with their correct URDF names and calculated angles
        };

        // Define a default pose (in radians) for when no person is detected.
        // These are initial guesses and MUST be fine-tuned to your robot's natural standing pose.
        this.defaultPose = {
            r_hip_pitch: 0,
            r_knee: 0,
            l_hip_pitch: 0,
            l_knee: 0,
            r_shoulder_pitch: 0,
            r_elbow: 0,
            l_shoulder_pitch: 0,
            l_elbow: 0,
            spine_pitch: 0,
            neck_pitch: 0,
            l_forearm_roll: 0,
            l_wrist_roll: 0
            // Ensure all joints in jointMap are also present here, with sensible default values
        };

        this.prevAngles = {};
        // Initialize prevAngles with defaultPose values for a smoother start
        for (const name in this.jointMap) {
            this.prevAngles[name] = this.defaultPose[name] !== undefined ? this.defaultPose[name] : 0;
        }

        this.smoothingFactor = 0.3; // Experiment with this value (0.1 for very smooth, 0.7 for responsive)
        this.initMediaPipe();
    }

    async initMediaPipe() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "./mediapipe_models/pose_landmarker_full (1).task", // Make sure this path is correct
                delegate: "GPU" // Try "GPU" for better performance if supported, otherwise "CPU"
            },
            runningMode: this.runningMode,
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        console.log("✅ MediaPipe PoseLandmarker initialized.");
        this.setupWebcam();
    }

    setupWebcam() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({
                    video: {
                        width: {
                            ideal: 640
                        },
                        height: {
                            ideal: 480
                        }
                    }
                })
                .then((stream) => {
                    this.video.srcObject = stream;
                    this.video.addEventListener("canplay", () => {
                        this.video.play();
                        this.overlayCanvas = document.getElementById("overlay");
                        this.overlayCanvas.width = this.video.videoWidth;
                        this.overlayCanvas.height = this.video.videoHeight;
                        this.overlayCtx = this.overlayCanvas.getContext("2d");
                        this.webcamInitialized = true;
                        console.log("🎥 Webcam stream started. Starting pose detection.");
                        // Immediately set to default pose after webcam init
                        this.setRobotToDefaultPose();
                        this.detectPosesInRealTime();
                    }, {
                        once: true
                    });
                })
                .catch((error) => {
                    console.error("❌ Error accessing webcam:", error);
                    this.viewer.updateStatus("Error accessing webcam: " + error.message, 'error');
                });
        } else {
            this.viewer.updateStatus("Webcam not supported by this browser.", 'error');
        }
    }

    async detectPosesInRealTime() {
        if (this.webcamInitialized && this.poseLandmarker) {
            const startTimeMs = performance.now();

            if (this.video.currentTime !== this.lastVideoTime) {
                this.lastVideoTime = this.video.currentTime;

                try {
                    const result = await this.poseLandmarker.detectForVideo(this.video, startTimeMs);

                    if (result.landmarks && result.landmarks.length > 0) {
                        // Person detected: draw landmarks and map pose to robot
                        this.drawLandmarks(result.landmarks[0]);
                        this.mapPoseToRobot(result.landmarks[0]);
                    } else {
                        // No person detected: clear overlay and set robot to default pose
                        this.clearOverlay();
                        this.setRobotToDefaultPose();
                        // console.log("No pose detected. Setting robot to default position.");
                    }
                } catch (error) {
                    console.error("❌ Pose detection error:", error);
                }
            }
        }
        requestAnimationFrame(this.detectPosesInRealTime.bind(this));
    }

    drawLandmarks(landmarks) {
        const ctx = this.overlayCtx;
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        ctx.save();
        // Mirror the video horizontally for intuitive user experience (as if looking in a mirror)
        ctx.translate(this.overlayCanvas.width, 0);
        ctx.scale(-1, 1);
        const scaleX = this.overlayCanvas.width;
        const scaleY = this.overlayCanvas.height;
        ctx.fillStyle = '#00FF00'; // Green for landmarks
        ctx.strokeStyle = '#FF0000'; // Red for connections
        ctx.lineWidth = 2;

        // Draw circles for each landmark
        for (let i = 0; i < landmarks.length; i++) {
            const x = landmarks[i].x * scaleX;
            const y = landmarks[i].y * scaleY;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
            // ctx.stroke(); // Uncomment if you want outlines on the circles
        }

        // Draw connections between key landmarks for better visualization
        this.drawConnection(ctx, landmarks, 24, 26, scaleX, scaleY); // R Hip to R Knee
        this.drawConnection(ctx, landmarks, 26, 28, scaleX, scaleY); // R Knee to R Ankle
        this.drawConnection(ctx, landmarks, 23, 25, scaleX, scaleY); // L Hip to L Knee
        this.drawConnection(ctx, landmarks, 25, 27, scaleX, scaleY); // L Knee to L Ankle

        this.drawConnection(ctx, landmarks, 12, 14, scaleX, scaleY); // R Shoulder to R Elbow
        this.drawConnection(ctx, landmarks, 14, 16, scaleX, scaleY); // R Elbow to R Wrist
        this.drawConnection(ctx, landmarks, 11, 13, scaleX, scaleY); // L Shoulder to L Elbow
        this.drawConnection(ctx, landmarks, 13, 15, scaleX, scaleY); // L Elbow to L Wrist

        this.drawConnection(ctx, landmarks, 23, 11, scaleX, scaleY); // L Hip to L Shoulder (Torso Left Side)
        this.drawConnection(ctx, landmarks, 24, 12, scaleX, scaleY); // R Hip to R Shoulder (Torso Right Side)
        this.drawConnection(ctx, landmarks, 11, 12, scaleX, scaleY); // Shoulders connection
        this.drawConnection(ctx, landmarks, 23, 24, scaleX, scaleY); // Hips connection

        // Central spine line (approximated)
        const hipMid = this.getMidPoint(landmarks[23], landmarks[24]);
        const shoulderMid = this.getMidPoint(landmarks[11], landmarks[12]);
        if (hipMid && shoulderMid) {
            this.drawConnection(ctx, [hipMid, shoulderMid], 0, 1, scaleX, scaleY); // Using array indices for convenience
        }
        if (shoulderMid && landmarks[0]) { // Shoulder mid to Nose (for neck)
            this.drawConnection(ctx, [shoulderMid, landmarks[0]], 0, 1, scaleX, scaleY);
        }

        ctx.restore();
    }

    // Clears the overlay canvas
    clearOverlay() {
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }

    // Helper to draw connections between landmarks
    drawConnection(ctx, landmarks, index1, index2, scaleX, scaleY) {
        // Ensure landmarks are valid and visible
        if (landmarks[index1] && landmarks[index1].visibility > 0.5 &&
            landmarks[index2] && landmarks[index2].visibility > 0.5) {
            const p1 = landmarks[index1];
            const p2 = landmarks[index2];
            ctx.beginPath();
            ctx.moveTo(p1.x * scaleX, p1.y * scaleY);
            ctx.lineTo(p2.x * scaleX, p2.y * scaleY);
            ctx.stroke();
        }
    }

    // Helper to get midpoint for spine/neck calculations
    getMidPoint(p1, p2) {
        if (!p1 || !p2 || p1.visibility < 0.5 || p2.visibility < 0.5) return null;
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
            z: (p1.z + p2.z) / 2,
            visibility: Math.min(p1.visibility, p2.visibility) // Take the lower visibility
        };
    }

    mapPoseToRobot(landmarks) {
        // MediaPipe Y-axis points downwards. X-axis points right. Z-axis points out from camera.
        // A "vertical" vector pointing upwards in the real world is {x:0, y:-1, z:0} in MediaPipe coords.
        const verticalRefVector = {
            x: 0,
            y: -1,
            z: 0
        };
        // A "horizontal" vector pointing to the right in the real world is {x:1, y:0, z:0} in MediaPipe coords.
        const horizontalRefVector = {
            x: 1,
            y: 0,
            z: 0
        };

        // Helper to get a vector from point A to point B
        const getVec = (a, b) => {
            if (!a || !b) return null;
            return {
                x: b.x - a.x,
                y: b.y - a.y,
                z: b.z - a.z
            };
        };

        // Helper to calculate the angle between two vectors in radians (always positive)
        const getAngle = (v1, v2) => {
            if (!v1 || !v2) return 0;
            const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
            const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
            const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
            return (mag1 && mag2) ? Math.acos(Math.min(Math.max(dot / (mag1 * mag2), -1.0), 1.0)) : 0;
        };

        // Helper to get a landmark if its visibility is above a threshold (0.5 for robustness)
        const v = (id) => landmarks[id] && landmarks[id].visibility > 0.5 ? landmarks[id] : null;


        // --- Legs ---
        const r_hip = v(24),
            r_knee = v(26),
            r_ankle = v(28);
        const l_hip = v(23),
            l_knee = v(25),
            l_ankle = v(27);

        // Right Leg
        if (r_hip && r_knee && r_ankle) {
            const upperLegVec = getVec(r_hip, r_knee); // Hip to Knee
            const lowerLegVec = getVec(r_knee, r_ankle); // Knee to Ankle

            const hipAngle = getAngle(upperLegVec, verticalRefVector);
            // Sign for right hip pitch: If moving leg forward makes robot move backward, flip the sign.
            const r_hip_pitch_val = (upperLegVec.x * verticalRefVector.y - upperLegVec.y * verticalRefVector.x) > 0 ? hipAngle : -hipAngle;
            this.smoothJoint("r_hip_pitch", r_hip_pitch_val, -1.5, 1.5); // Min/Max Radians for Hip Flexion/Extension
            console.log(`Debug: r_hip_pitch_val (raw): ${r_hip_pitch_val.toFixed(3)}`);

            // r_knee: Angle between upper and lower leg. Knee flexion (bending) usually increases angle.
            const kneeAngle = Math.PI - getAngle(upperLegVec, lowerLegVec); // Math.PI - angle gives internal angle.
            this.smoothJoint("r_knee", kneeAngle, 0, 2.0); // Min/Max Radians for Knee Flexion (0 to ~114 deg)
            console.log(`Debug: r_knee_val (raw): ${kneeAngle.toFixed(3)}`);
        } else {
            // console.log("Debug: Right leg landmarks not visible enough.");
        }


        // Left Leg
        if (l_hip && l_knee && l_ankle) {
            const upperLegVec = getVec(l_hip, l_knee);
            const lowerLegVec = getVec(l_knee, l_ankle);

            const hipAngle = getAngle(upperLegVec, verticalRefVector);
            // Sign for left hip pitch: Adjust based on observed mirroring. Often opposite to right for X-axis component.
            const l_hip_pitch_val = (upperLegVec.x * verticalRefVector.y - upperLegVec.y * verticalRefVector.x) < 0 ? hipAngle : -hipAngle;
            this.smoothJoint("l_hip_pitch", l_hip_pitch_val, -1.5, 1.5);
            console.log(`Debug: l_hip_pitch_val (raw): ${l_hip_pitch_val.toFixed(3)}`);

            const kneeAngle = Math.PI - getAngle(upperLegVec, lowerLegVec);
            this.smoothJoint("l_knee", kneeAngle, 0, 2.0);
            console.log(`Debug: l_knee_val (raw): ${kneeAngle.toFixed(3)}`);
        } else {
            // console.log("Debug: Left leg landmarks not visible enough.");
        }


        // --- Arms ---
        const r_shoulder = v(12),
            r_elbow = v(14),
            r_wrist = v(16);
        const l_shoulder = v(11),
            l_elbow = v(13),
            l_wrist = v(15);

        // Right Arm
        if (r_shoulder && r_elbow && r_wrist) {
            const upperArmVec = getVec(r_shoulder, r_elbow); // Shoulder to Elbow
            const forearmVec = getVec(r_elbow, r_wrist); // Elbow to Wrist

            const shoulderAngle = getAngle(upperArmVec, verticalRefVector);
            // Sign for right shoulder pitch: If lifting arm forward makes robot arm go backward, flip sign.
            const r_shoulder_pitch_val = (upperArmVec.x * verticalRefVector.y - upperArmVec.y * verticalRefVector.x) > 0 ? shoulderAngle : -shoulderAngle;
            this.smoothJoint("r_shoulder_pitch", r_shoulder_pitch_val, -1.5, 1.5);
            console.log(`Debug: r_shoulder_pitch_val (raw): ${r_shoulder_pitch_val.toFixed(3)}`);

            const elbowAngle = Math.PI - getAngle(upperArmVec, forearmVec);
            this.smoothJoint("r_elbow", elbowAngle, 0, 2.0);
            console.log(`Debug: r_elbow_val (raw): ${elbowAngle.toFixed(3)}`);
        } else {
            // console.log("Debug: Right arm landmarks not visible enough.");
        }

        // Left Arm
        if (l_shoulder && l_elbow && l_wrist) {
            const upperArmVec = getVec(l_shoulder, l_elbow);
            const forearmVec = getVec(l_elbow, l_wrist);

            const shoulderAngle = getAngle(upperArmVec, verticalRefVector);
            // Sign for left shoulder pitch: Adjust based on observed mirroring. Often opposite to right for X-axis component.
            const l_shoulder_pitch_val = (upperArmVec.x * verticalRefVector.y - upperArmVec.y * verticalRefVector.x) < 0 ? shoulderAngle : -shoulderAngle;
            this.smoothJoint("l_shoulder_pitch", l_shoulder_pitch_val, -1.5, 1.5);
            console.log(`Debug: l_shoulder_pitch_val (raw): ${l_shoulder_pitch_val.toFixed(3)}`);

            const elbowAngle = Math.PI - getAngle(upperArmVec, forearmVec);
            this.smoothJoint("l_elbow", elbowAngle, 0, 2.0);
            console.log(`Debug: l_elbow_val (raw): ${elbowAngle.toFixed(3)}`);
        }

        // --- Torso & Neck ---
        const leftHip = v(23),
            rightHip = v(24);
        const leftShoulder = v(11),
            rightShoulder = v(12);
        const nose = v(0);

        // spine_pitch: Forward/backward bend of the torso. (Revolute51, URDF Y-axis)
        if (leftHip && rightHip && leftShoulder && rightShoulder) {
            const hipMid = this.getMidPoint(leftHip, rightHip);
            const shoulderMid = this.getMidPoint(leftShoulder, rightShoulder);

            if (hipMid && shoulderMid) {
                const spineVec = getVec(hipMid, shoulderMid); // Vector from hips to shoulders
                const spineAngle = getAngle(spineVec, verticalRefVector);
                // Sign for spine pitch: If leaning forward makes robot lean backward, flip sign.
                const spine_val = (spineVec.x * verticalRefVector.y - spineVec.y * verticalRefVector.x) > 0 ? spineAngle : -spineAngle;
                this.smoothJoint("spine_pitch", spine_val, -0.6, 0.6); // Min/Max Radians for Spine Bend
                console.log(`Debug: spine_pitch_val (raw): ${spine_val.toFixed(3)}`);
            }
        }

        // neck_pitch: Nodding head up/down. (Revolute72, URDF Y-axis)
        if (nose && leftShoulder && rightShoulder) {
            const shoulderMid = this.getMidPoint(leftShoulder, rightShoulder);
            if (shoulderMid) {
                const neckVec = getVec(shoulderMid, nose); // Vector from shoulders to nose
                const neckAngle = getAngle(neckVec, verticalRefVector);
                // Sign for neck pitch: If nodding down makes robot head go up, flip sign.
                const neck_pitch_val = (neckVec.x * verticalRefVector.y - neckVec.y * verticalRefVector.x) > 0 ? neckAngle : -neckAngle;
                this.smoothJoint("neck_pitch", neck_pitch_val, -0.6, 0.6);
                console.log(`Debug: neck_pitch_val (raw): ${neck_pitch_val.toFixed(3)}`);
            }
        }

        // --- Added Roll/Yaw Approximations ---
        // l_forearm_roll: (Revolute116, URDF Z-axis)
        if (l_elbow && l_wrist && l_shoulder) {
            const upperArmVec = getVec(l_shoulder, l_elbow);
            const forearmVec = getVec(l_elbow, l_wrist);
            // This calculation is a rough approximation for roll. You might need to refine this.
            const l_forearm_roll_val = (forearmVec.x * upperArmVec.y - forearmVec.y * upperArmVec.x) * 2;
            this.smoothJoint("l_forearm_roll", l_forearm_roll_val, -Math.PI, Math.PI);
            console.log(`Debug: l_forearm_roll_val (raw): ${l_forearm_roll_val.toFixed(3)}`);
        }

        // l_wrist_roll: (Revolute118, URDF X-axis)
        const l_wrist_index = v(19); // Left index finger landmark
        if (l_wrist && l_wrist_index) {
            const wristIndexVec = getVec(l_wrist, l_wrist_index);
            // This calculation is a rough approximation for wrist roll.
            const l_wrist_roll_val = wristIndexVec.x * 5;
            this.smoothJoint("l_wrist_roll", l_wrist_roll_val, -Math.PI / 2, Math.PI / 2);
            console.log(`Debug: l_wrist_roll_val (raw): ${l_wrist_roll_val.toFixed(3)}`);
        }
    }

    /**
     * Sets the robot's joints to their predefined default pose.
     * This method is called when no person is detected by MediaPipe.
     */
    setRobotToDefaultPose() {
        for (const jointName in this.defaultPose) {
            const angle = this.defaultPose[jointName];
            const realName = this.jointMap[jointName];
            
            // Retrieve joint limits from the viewer's parsed URDF data
            const lowerLimit = this.viewer.joints[realName]?.limit?.lower || -Infinity;
            const upperLimit = this.viewer.joints[realName]?.limit?.upper || Infinity;

            // Apply the default pose with smoothing and clamping, using actual URDF limits
            this.smoothJoint(jointName, angle, lowerLimit, upperLimit);
        }
    }

    /**
     * Smooths a target joint angle and updates the robot's joint.
     * @param {string} name - The human-friendly name of the joint (e.g., 'r_hip_pitch').
     * @param {number} targetAngle - The raw target angle from MediaPipe calculation in radians.
     * @param {number} min - The minimum allowed angle for this joint in radians.
     * @param {number} max - The maximum allowed angle for this joint in radians.
     */
    smoothJoint(name, targetAngle, min = -1.5, max = 1.5) {
        const prev = this.prevAngles[name] || 0;
        const alpha = this.smoothingFactor;
        let smoothed = prev * (1 - alpha) + targetAngle * alpha;
        smoothed = Math.max(min, Math.min(max, smoothed)); // Clamp to limits
        this.prevAngles[name] = smoothed; // Store for next iteration's smoothing

        const realName = this.jointMap[name];
        if (realName) {
            this.viewer.updateJoint(realName, smoothed);
            // Uncomment the line below to see the final smoothed and clamped values for all joints
            // console.log(`Joint: ${name} (${realName}), Target (raw): ${targetAngle.toFixed(3)}, Smoothed (final): ${smoothed.toFixed(3)}`);
        } else {
            console.warn(`⚠️ No URDF mapping found for joint: ${name}. Please check jointMap.`);
        }
    }
}
