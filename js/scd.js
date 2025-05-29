const PIXEL_CHANGE_THRESHOLD = 30;   // ピクセルの変化を検出する閾値
const SCENE_CHANGE_THRESHOLD = 0.05; // シーンの切り替わりを検出する閾値

export function detectSceneChange(img1, img2) {
    if (img1.width !== img2.width || img1.height !== img2.height) {
        return true;
    }
    const n = img1.width * img1.height;

    let D = 0;
    for (let i = 0; i < n; i++) {
        const r = Math.abs(img1.data[i * 4] - img2.data[i * 4]);
        const g = Math.abs(img1.data[i * 4 + 1] - img2.data[i * 4 + 1]);
        const b = Math.abs(img1.data[i * 4 + 2] - img2.data[i * 4 + 2]);
        const diff = r + g + b;
        if (diff > PIXEL_CHANGE_THRESHOLD) {
            D++;
        }
    }
    const changeRatio = D / n;
    return changeRatio > SCENE_CHANGE_THRESHOLD;
}