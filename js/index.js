import { BoundingBox, TransItem, TranslationViewer } from "./viewer.js";
import { detectSceneChange } from "./scd.js";

function getImageDataFromBitmap(bitmap) {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

async function getBlobFromBitmap(bitmap) {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    return await canvas.convertToBlob({ type: "image/png" })
}

async function fetchTranslatedItems(blob) {
    const formData = new FormData();
    formData.append("screen", blob);

    const rawTransInfo = await fetch("/api/translate", {
        method: "POST",
        body: formData,
    });
    const transInfo = await rawTransInfo.json();

    let items = [];
    for (const item of transInfo["result"]) {
        const bbox = BoundingBox.fromVertices(item["bbox"]);
        const transItem = new TransItem(item["translated"], bbox, item["font_size"], true);
        items.push(transItem);
    }
    return items;
}

class ScreenCapture {
    constructor() {
        this.imageCapture = null;
        this.stream = null;
    }

    async start() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new Error("getDisplayMedia is not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
        });

        const track = stream.getVideoTracks()[0];
        this.imageCapture = new ImageCapture(track);
        this.stream = stream;
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.imageCapture = null;
    }

    async getFrame() {
        if (!this.imageCapture) {
            throw new Error("ImageCapture is not initialized. Call start() first.");
        }

        return await this.imageCapture.grabFrame();
    }
}

class SceneChangeDetector {
    constructor() {
        this.previousFrame = null;
    }

    detect(currentFrame) {
        if (!this.previousFrame) {
            this.previousFrame = currentFrame;
            return true;
        }

        const previousImageData = getImageDataFromBitmap(this.previousFrame);
        const currentImageData = getImageDataFromBitmap(currentFrame);

        const changeDetected = detectSceneChange(previousImageData, currentImageData);
        this.previousFrame = currentFrame;

        return changeDetected;
    }
}

class SceneTranslator {
    constructor() {
        this.isTranslating = false;
    }

    async translateFrame(currentFrameBitmap) {
        if (this.isTranslating) {
            return null;
        }

        let translatedItems = null;
        this.isTranslating = true;
        try {
            const blob = await getBlobFromBitmap(currentFrameBitmap);
            translatedItems = await fetchTranslatedItems(blob);
        } finally {
            this.isTranslating = false;
        }
        return translatedItems;
    }
}

class ScreenTranslationController {
    constructor(canvas, captureInterval) {
        this.viewer = new TranslationViewer(canvas);
        this.screenCapture = new ScreenCapture(); 
        this.sceneChangeDetector = new SceneChangeDetector();
        this.sceneTranslator = new SceneTranslator();
        this.intervalId = null;
        this.captureInterval = captureInterval;
    }

    async start() {
        await this.screenCapture.start();
        await this.captureAndTranslate();
        this.intervalId = setInterval(() => this.captureAndTranslate(), this.captureInterval);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.screenCapture.stop();
    }

    async captureAndTranslate() {
        const currentFrame = await this.screenCapture.getFrame();
        if (!this.sceneChangeDetector.detect(currentFrame)) {
            return;
        }
        const translatedItems = await this.sceneTranslator.translateFrame(currentFrame);
        if (!translatedItems) {
            return;
        }
        const newBgBitmap = await createImageBitmap(currentFrame);
        this.viewer.update(translatedItems, newBgBitmap);
    }
}

// 初期化処理
document.addEventListener("DOMContentLoaded", async function() {
    const canvas = document.getElementById("canvas");

    // キャンバスのサイズをDOMのサイズに合わせる
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const controller = new ScreenTranslationController(canvas, 2000);

    const captureButton = document.getElementById("button-capture");
    captureButton.addEventListener("click", async () => {
        controller.stop();
        await controller.start();
    })
});