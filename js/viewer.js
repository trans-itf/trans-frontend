export class TransItem {
    constructor(text, bbox, fontSize, visible) {
        this.text = text;
        this.bbox = bbox;
        this.visible = visible;
        this.fontSize = fontSize;
    }
}

export class BoundingBox {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    contains(x, y) {
        return x >= this.x && x <= this.x + this.width &&
               y >= this.y && y <= this.y + this.height;
    }

    static fromVertices(vertices) {
        const x = vertices[0]["x"];
        const y = vertices[0]["y"];
        const width = vertices[1]["x"] - vertices[0]["x"];
        const height = vertices[2]["y"] - vertices[0]["y"];
        return new BoundingBox(x, y, width, height);
    }
}

export class TranslationViewer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.transItems = [];
        this.backgroundImage = null;

        this.resizeObserver = new ResizeObserver((entries) => this.onResize(entries));
        this.resizeObserver.observe(this.canvas);

        this.canvas.addEventListener("click", (e) => this.onClick(e));
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    update(transItems, backgroundImage) {
        this.transItems = transItems;
        this.backgroundImage = backgroundImage;
        this.render();
    }

    calculateScale() {
        if (this.backgroundImage == null) {
            return 1;
        }

        const bgAspect = this.backgroundImage.width / this.backgroundImage.height;
        const canvasAspect = this.canvas.width / this.canvas.height;
        let scale;
        if (bgAspect > canvasAspect) {
            scale = this.canvas.width / this.backgroundImage.width;
        } else {
            scale = this.canvas.height / this.backgroundImage.height;
        }
        return scale;
    }

    render() {
        if (this.backgroundImage == null) {
            return;
        }

        const bufCanvas = new OffscreenCanvas(this.backgroundImage.width, this.backgroundImage.height);
        const bufCtx = bufCanvas.getContext("2d");

        // 背景の描画
        bufCtx.drawImage(this.backgroundImage, 0, 0);

        // 翻訳ボックスの描画
        for (const item of this.transItems) {
             if (item.visible) {
                 bufCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
                 bufCtx.fillRect(item.bbox.x, item.bbox.y, item.bbox.width, item.bbox.height);

                 // 翻訳後のテキストを描画
                 bufCtx.fillStyle = "black";
                 bufCtx.font = `${item.fontSize}px 'M PLUS 1'`;
                 bufCtx.textBaseline = "top";
                 item.text.split("\n").forEach((line, i) => {
                    bufCtx.fillText(line, item.bbox.x + 1, item.bbox.y + i * item.fontSize + 1);
                 });
            }

            // バウンディングボックスの外枠の描画
            bufCtx.fillStyle = "rgba(0, 0, 0, 1)";
            bufCtx.lineWidth = 1;
            bufCtx.strokeRect(item.bbox.x, item.bbox.y, item.bbox.width, item.bbox.height)
        }

        // バッファのサイズをキャンバスのサイズに合わせて描画
        let scale = this.calculateScale();
        const drawWidth = this.backgroundImage.width * scale;
        const drawHeight = this.backgroundImage.height * scale;
        this.clear();
        this.ctx.drawImage(bufCanvas, 0, 0, drawWidth, drawHeight);
    }

    onClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scale = this.calculateScale();
        const dpr = window.devicePixelRatio;
        const x = (event.clientX - rect.left) * dpr / scale;
        const y = (event.clientY - rect.top) * dpr / scale;

        // クリックした位置にある翻訳ボックスをトグル
        for (const item of this.transItems) {
            if (item.bbox.contains(x, y)) {
                item.visible = !item.visible;
            }
        }
        this.render();
    }

    onResize(entries) {
        // キャンバスのサイズをブラウザのサイズに合わせて変更
        const entry = entries.find(entry => entry.target === this.canvas);
        this.canvas.width = entry.devicePixelContentBoxSize[0].inlineSize;
        this.canvas.height = entry.devicePixelContentBoxSize[0].blockSize;
        this.render();
    }

    getBackgroundImage() {
        return this.backgroundImage;
    }
}