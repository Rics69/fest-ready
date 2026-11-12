# Демо-игра Saltmoth — промпты для арта

Вымышленная игра для примеров на лендинге (блоки 4 и 6), тестов Capsule Kit и разборов в постах. Своя, чтобы не трогать чужие права. Название проверено поиском Steam 12.11.2026 — совпадений нет.

**Saltmoth** — роглайт-исследование. Смотритель маяка с крыльями мотылька зажигает фонари на солёных островах, чтобы корабли нашли дорогу сквозь шторм. Теги для полки: Roguelite, Exploration, Atmospheric, Stylized.

## Что нужно и куда положить

| Файл | Что это | Размер | Обязательно |
| --- | --- | --- | --- |
| `public/demo/saltmoth/keyart.png` | Ключевой арт 16:9 | от 3840×2160 после апскейла | Да |
| `public/demo/saltmoth/logo.png` | Логотип в одну строку, прозрачный фон | от 2000 px в ширину | Да |
| `public/demo/saltmoth/keyart-wide.png` | Тот же кадр, расширенный до 31:10 для library hero | от 3840×1240 | Желательно |
| `public/demo/saltmoth/logo-stacked.png` | Логотип в две строки SALT / MOTH для вертикальных капсул | от 1200 px в ширину | Желательно |

Плохие примеры капсул (тонкий шрифт, низкий контраст, надпись «Wishlist now», лавровый венок) генерировать не нужно — соберём их кодом из этого же арта в фазе 1, так надпись будет точной и её прочитает проверка.

## Общий стиль

Этот блок уже встроен в каждый промпт ниже — менять его нужно во всех сразу.

> Painterly 2D digital illustration, clean readable silhouettes, strong value contrast, soft volumetric light. Limited palette: deep teal and ink blue for sea and sky, muted violet-grey storm clouds, warm amber lantern glow, salt-white highlights.

Почему так: тёплый фонарь на холодном фоне даёт одну яркую точку внимания, а крупные силуэты не рассыпаются в 120×45. Для проверки контраста это удобный арт: светлый логотип на тёмном небе читается, а возле фонаря — уже нет.

## 1. Ключевой арт (обязательно)

Соотношение 16:9 (если генератор не умеет — 3:2), максимальное разрешение генератора.

```text
Key art for an indie video game. A small hooded lighthouse keeper with large soft moth wings stands on a salt-crusted cliff in the left third of the frame, raising a glowing amber lantern. The keeper is clearly visible: about one quarter of the frame width and most of the frame height, with space above the head. Behind: a dark stormy sea with tall waves, and a distant crooked lighthouse on the right side. The upper half of the frame is calm stormy sky with soft clouds, intentionally left empty for a title logo. Painterly 2D digital illustration, clean readable silhouettes, strong value contrast, soft volumetric light rays from the lantern. Limited palette: deep teal and ink blue for sea and sky, muted violet-grey storm clouds, warm amber lantern glow, salt-white highlights. Wide cinematic composition, the scene continues to every edge, nothing important touches the edges. No text, no letters, no logo, no watermark, no signature, no border, no UI.
```

Почему композиция именно такая: из одного кадра Kit режет все 9 ассетов. Смотритель в левой трети — для вариантов «Герой + логотип». Пустое небо сверху — место под логотип. Фигура занимает четверть ширины, поэтому вертикальный кроп 2:3 (library capsule 600×900) целиком её вмещает.

**После генерации:** увеличить до 3840 px в ширину и больше (бесплатно — Upscayl, или встроенный апскейлер генератора).

## 2. Логотип в одну строку (обязательно)

Если генератор умеет прозрачный фон — включить его. Если нет — заменить последнюю фразу промпта на `Isolated on a solid flat #FF00FF magenta background.` и убрать фон потом (remove.bg, Photoshop или Figma).

```text
Game logo wordmark that reads exactly "SALTMOTH" in a single line, all capital letters, spelled S-A-L-T-M-O-T-H. Chunky, heavy, slightly rounded custom display letters with thick even strokes and generous letter spacing, designed to stay legible when shrunk to 120 pixels wide. A small simple moth symbol sits to the left of the word as a separate logomark. Salt-white letters with a thick dark ink-blue outline and a subtle warm amber inner glow, so the logo reads on both dark and bright backgrounds. Flat, vector-like rendering, no texture noise, no drop shadow beyond the outline. Centered, with empty margin around it. No other text, no tagline, no mockup, no background scene. Isolated on a fully transparent background, PNG with alpha.
```

Почему так: малая капсула Steam должна «почти полностью» занимать логотипом, и в 120×45 выживают только толстые штрихи. Белые буквы с тёмной обводкой читаются и на небе, и на светлом фонаре — для library logo Valve требует, чтобы логотип был виден на любом фоне.

## 3. Расширенный кадр для library hero (желательно)

Library hero — 3840×1240 (31:10), главное должно уместиться в центральную безопасную зону. Делается из готового ключевого арта:

- **Photoshop, Firefly, Krea** — «Generative Expand» по бокам до 31:10;
- **Midjourney** — Zoom Out или Pan влево и вправо, затем `--ar 31:10`;
- **ChatGPT** — 31:10 не поддерживает; выручит любой инструмент выше.

Промпт для расширения:

```text
Extend this image to the left and right into an ultra-wide 31:10 panorama of the same scene: more stormy sea and dark rocks on the left, more sky, waves and the distant lighthouse on the right. Keep the keeper, the moth wings and the amber lantern unchanged. Same painterly style, same lighting and palette. No text, no letters, no logo, no watermark.
```

Если не получится, Kit сам достроит края размытием — это его штатное поведение для узкого арта. Но для демо лучше настоящий широкий кадр.

## 4. Логотип в две строки (желательно)

Для вертикальных капсул (748×896 и 600×900): длинное слово в одну строку там получается мелким.

```text
Game logo wordmark stacked in two lines: "SALT" on the top line and "MOTH" on the bottom line, all capital letters, both lines the same width. Chunky, heavy, slightly rounded custom display letters with thick even strokes. A small simple moth symbol sits centered above the word SALT. Salt-white letters with a thick dark ink-blue outline and a subtle warm amber inner glow. Flat, vector-like rendering, no texture noise. Centered, with empty margin around it. No other text, no tagline, no mockup, no background scene. Isolated on a fully transparent background, PNG with alpha.
```

## Проверить перед тем, как класть в репозиторий

- [ ] В логотипе ровно SALTMOTH — генераторы путают и дублируют буквы
- [ ] На ключевом арте нет букв, подписей и водяных знаков
- [ ] У логотипа настоящая прозрачность (шахматка в просмотрщике) и нет светлого ореола по краю
- [ ] Логотип, уменьшенный до 120 px в ширину, читается
- [ ] Условия генератора разрешают коммерческое использование (у платных тарифов ChatGPT и Midjourney — да)

Если буквы не получаются, запасной путь — набрать SALTMOTH в Figma свободным шрифтом (Bungee или Titan One, лицензия SIL OFL), дорисовать обводку и экспортировать PNG.

## Честность на лендинге

FestReady обещает «собираем из вашего арта, а не генерируем», а FAQ отвечает на вопрос «Вы рисуете ИИ?». Поэтому рядом с примером стоит подпись: «Saltmoth — вымышленная игра для примера, арт сгенерирован». Обещание продукта это не нарушает: генерируем мы только свою витрину, а не арт пользователей.

## Что использовано

Заполнить после генерации — чтобы через полгода было понятно, откуда арт и можно ли его использовать.

| Файл | Генератор и тариф | Дата | Промпт |
| --- | --- | --- | --- |
| keyart.png | | | № 1 |
| logo.png | | | № 2 |
| keyart-wide.png | | | № 3 |
| logo-stacked.png | | | № 4 |
