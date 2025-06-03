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

    const rawTransInfo = await fetch("http://localhost:8020/api/translate", {
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

async function startCapture() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
    });
    const track = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);

    const viewer = new TranslationViewer(canvas);

    let translating = false;
    const updateFrame = async () => {
        imageCapture.grabFrame().then(async (frame) => {
            const currentBgBitmap = viewer.getBackgroundImage();

            if (currentBgBitmap != null && !translating) {
                const currentBgData = getImageDataFromBitmap(currentBgBitmap);
                const newBgData = getImageDataFromBitmap(frame);

                if (!detectSceneChange(currentBgData, newBgData)) {
                    console.log("Background image is the same, skipping update.");
                    return;
                }
            }
            
            if (!translating) {
                translating = true;
                try {
                    const blob = await getBlobFromBitmap(frame)
                    const items = await fetchTranslatedItems(blob);
                    const newBg = await createImageBitmap(frame);
                    
                    viewer.update(items, newBg);
                } finally {
                    translating = false;
                }
            }
        });
    };

    await updateFrame();
    setInterval(async () => {
        await updateFrame();
    }, 2000);
}

// 初期化処理
document.addEventListener("DOMContentLoaded", async function() {
    const reloadButton = document.getElementById("button-capture");
    reloadButton.addEventListener("click", async () => {
        await startCapture();
    })
    
    const canvas = document.getElementById("canvas");

    // キャンバスのサイズをDOMのサイズに合わせる
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
});