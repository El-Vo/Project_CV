import { CONFIG } from './config.js';

/**
 * FeatureTracker using OpenCV.js KCF (Kernelized Correlation Filters) or MIL.
 * This provides professional-grade visual feature tracking, similar to MediaPipe's underlying tech.
 */
export class FeatureTracker {
    constructor() {
        this.currentBox = null;
        this.isInitialized = false;
        
        // OpenCV Mats for Optical Flow
        this.prevGray = null;
        this.prevPoints = null;
        this.workCanvas = document.createElement('canvas');
        this.workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true });
        
        // Constants
        this.winSize = null;
        this.maxLevel = 2;
        this.criteria = null;
    }

    /**
     * Start tracking using Feature Points (Lucas-Kanade)
     */
    init(video, box, visibleRegion = null) {
        if (typeof cv === 'undefined' || !cv.Mat) return false;

        try {
            const [x1, y1, x2, y2] = box;
            const w = x2 - x1;
            const h = y2 - y1;
            
            if (w <= 0 || h <= 0) return false;

            // Determine source region exactly like depth.js
            let sx = 0, sy = 0, sw, sh;
            if (visibleRegion && visibleRegion.width > 0 && visibleRegion.height > 0) {
                sx = visibleRegion.x;
                sy = visibleRegion.y;
                sw = visibleRegion.width;
                sh = visibleRegion.height;
            } else {
                sw = video.videoWidth || video.width;
                sh = video.videoHeight || video.height;
            }

            this.workCanvas.width = sw;
            this.workCanvas.height = sh;
            // Draw only the visible ROI
            this.workCtx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
            
            let frame = cv.imread(this.workCanvas);
            if (this.prevGray) this.prevGray.delete();
            this.prevGray = new cv.Mat();
            cv.cvtColor(frame, this.prevGray, cv.COLOR_RGBA2GRAY);
            
            // Find points to track within the box (coordinates are relative to the ROI)
            const mask = new cv.Mat.zeros(this.prevGray.rows, this.prevGray.cols, cv.CV_8UC1);
            const roiRect = new cv.Rect(Math.max(0, x1), Math.max(0, y1), 
                                       Math.min(frame.cols - x1, w), Math.min(frame.rows - y1, h));
            mask.roi(roiRect).setTo(new cv.Scalar(255));

            if (this.prevPoints) this.prevPoints.delete();
            this.prevPoints = new cv.Mat();
            cv.goodFeaturesToTrack(this.prevGray, this.prevPoints, 50, 0.01, 5, mask);

            mask.delete();
            frame.delete();

            if (this.prevPoints.rows > 5) {
                this.currentBox = [x1, y1, x2, y2];
                this.isInitialized = true;
                this.winSize = new cv.Size(15, 15);
                this.criteria = new cv.TermCriteria(cv.TermCriteria_COUNT + cv.TermCriteria_EPS, 10, 0.03);
                return true;
            }
        } catch (err) {
            console.error("Tracking Init Error:", err);
        }
        return false;
    }

    /**
     * Track features into the next frame
     */
    track(video, visibleRegion = null) {
        if (!this.isInitialized || !this.prevPoints || this.prevPoints.rows === 0) return null;

        try {
            // Determine source region exactly like depth.js
            let sx = 0, sy = 0, sw, sh;
            if (visibleRegion && visibleRegion.width > 0 && visibleRegion.height > 0) {
                sx = visibleRegion.x;
                sy = visibleRegion.y;
                sw = visibleRegion.width;
                sh = visibleRegion.height;
            } else {
                sw = video.videoWidth || video.width;
                sh = video.videoHeight || video.height;
            }

            // Sync canvas dimensions if needed
            if (this.workCanvas.width !== sw || this.workCanvas.height !== sh) {
                this.workCanvas.width = sw;
                this.workCanvas.height = sh;
            }

            this.workCtx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
            let frame = cv.imread(this.workCanvas);
            let nextGray = new cv.Mat();
            cv.cvtColor(frame, nextGray, cv.COLOR_RGBA2GRAY);

            let nextPoints = new cv.Mat();
            let status = new cv.Mat();
            let err = new cv.Mat();

            cv.calcOpticalFlowPyrLK(this.prevGray, nextGray, this.prevPoints, nextPoints, status, err, this.winSize, this.maxLevel, this.criteria);

            // Calculate median movement
            let dxs = [], dys = [];
            let validCount = 0;
            for (let i = 0; i < status.rows; i++) {
                if (status.data[i] === 1) {
                    dxs.push(nextPoints.data32F[i * 2] - this.prevPoints.data32F[i * 2]);
                    dys.push(nextPoints.data32F[i * 2 + 1] - this.prevPoints.data32F[i * 2 + 1]);
                    validCount++;
                }
            }

            if (validCount < 5) {
                nextGray.delete(); nextPoints.delete(); status.delete(); err.delete(); frame.delete();
                return null;
            }

            dxs.sort((a, b) => a - b);
            dys.sort((a, b) => a - b);
            const mdx = dxs[Math.floor(dxs.length / 2)];
            const mdy = dys[Math.floor(dys.length / 2)];

            // Update box (relative coordinates)
            this.currentBox[0] += mdx;
            this.currentBox[1] += mdy;
            this.currentBox[2] += mdx;
            this.currentBox[3] += mdy;

            // Boundary check: Restart tracking if box leaves the visible area
            const [x1, y1, x2, y2] = this.currentBox;
            if (x2 < 0 || y2 < 0 || x1 > sw || y1 > sh) {
                nextGray.delete(); nextPoints.delete(); status.delete(); err.delete(); frame.delete();
                console.log("Tracking box left visible area, triggering reset...");
                return null;
            }

            // Prepare for next frame
            this.prevGray.delete();
            this.prevGray = nextGray;
            this.prevPoints.delete();
            // Filter points for next frame (only keep successful ones)
            let goodNextPoints = new cv.Mat(validCount, 1, cv.CV_32FC2);
            let gIdx = 0;
            for (let i = 0; i < status.rows; i++) {
                if (status.data[i] === 1) {
                    goodNextPoints.data32F[gIdx * 2] = nextPoints.data32F[i * 2];
                    goodNextPoints.data32F[gIdx * 2 + 1] = nextPoints.data32F[i * 2 + 1];
                    gIdx++;
                }
            }
            this.prevPoints = goodNextPoints;

            status.delete(); err.delete(); frame.delete(); nextPoints.delete();

            return {
                box: this.currentBox,
                confidence: validCount / 50 
            };

        } catch (err) {
            console.error("Tracking Update Error:", err);
            return null;
        }
    }
}

