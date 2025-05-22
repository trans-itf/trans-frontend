import { BoundingBox, TransItem, TranslationViewer } from "./viewer.js";

function setStatusText(text) {
    const status = document.getElementById("status");
    status.textContent = text;
}

async function loadImage(imageUrl) {
    const res = await fetch(imageUrl);
    const blob = await res.blob();

    const url = URL.createObjectURL(blob);
    console.log(url)
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
}

async function fetchTranslatedItems() {
    const rawTransInfo = await fetch("http://localhost:8020");
    const transInfo = await rawTransInfo.json();

    let items = [];
    for (const item of transInfo["ret"][0]) {
        const bbox = BoundingBox.fromVertices(item[2]);
        const transItem = new TransItem(item[1], bbox, item[3], true);
        items.push(transItem);
    }
    console.log(items);
    return items;
}

// 初期化処理
document.addEventListener("DOMContentLoaded", async function() {
    const reloadButton = document.getElementById("button-reload");
    reloadButton.addEventListener("click", () => {
        window.location.reload();
    })

    const canvas = document.getElementById("canvas");

    // キャンバスのサイズをDOMのサイズに合わせる
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const viewer = new TranslationViewer(canvas);

    const updateCanvas = async () => {
        setStatusText("Loading...");
        const items = await fetchTranslatedItems();
        const bg = await loadImage("http://localhost:8020/static/screenshot.png");
        viewer.update(items, bg);
        setStatusText("Loading complete");
    }

    await updateCanvas();
    setInterval(async () => {
        const rawChanged = await fetch("http://localhost:8020/change"); 
        const changed = await rawChanged.json();

        if (changed["info"] == "no change") {
            setStatusText("No change");
            return;
        }

        await updateCanvas();
    }, 2000);
});