# BANG! Dice — Web Game

Bản web game fan-made chơi một người với bot, mô phỏng luật nền của **BANG! The Dice Game** cho bàn 3–8 người.

## Chơi trực tuyến

[Mở phiên bản production](https://bang-dice-web-game.dabo-social-7911.chatgpt.site)

## Tính năng

- Bàn chơi tự điều chỉnh theo 3–8 người.
- Phân phối vai trò, khoảng cách, xúc xắc và 16 kỹ năng nhân vật.
- Hoạt ảnh tung xúc xắc, chọn mục tiêu và giải quyết hành động tuần tự.
- Bot tự chơi; nhật ký và giao diện tiếng Việt.

## Chạy cục bộ

Yêu cầu Node.js 22.13 trở lên.

```bash
npm ci
npm run dev
```

## Build và kiểm thử

```bash
npm run build
npm test
```

## Cấu trúc chính

- `app/game.ts`: trạng thái ván chơi và luật.
- `app/page.tsx`: giao diện và hoạt ảnh.
- `app/globals.css`: bố cục và hình thức.
- `public/`: hình ảnh sử dụng trong game.
- `tests/`: kiểm thử luật và HTML đầu ra.

## Giấy phép và tài sản

Phần mã nguồn nguyên bản của dự án được phát hành theo [MIT License](LICENSE). Hình ảnh, tên gọi, thương hiệu, nội dung lá bài và phần chữ dựa trên trò chơi gốc **không thuộc giấy phép MIT**; xem [ASSETS.md](ASSETS.md) trước khi sao chép hoặc phân phối.

Đây là dự án fan-made, không phải sản phẩm chính thức và không có liên kết hay xác nhận từ nhà phát hành. BANG! và BANG! The Dice Game thuộc về các chủ sở hữu tương ứng. Tham khảo [luật chính thức](https://www.dvgiochi.com/giochi/bangtdg/download/BANG%21%20Dice%20Game_Rules_ENG.pdf).
