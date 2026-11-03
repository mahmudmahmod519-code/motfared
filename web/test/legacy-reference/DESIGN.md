# مرجع تصميم Lead to Doctor

مرجع عملي (مش وصف إنشائي) لكل قيم التصميم المستخدمة فعليًا في الداشبورد (`backend/public/index.html`)، جاهز تدّيه لأي أداة تصميم/توليد عشان تصمم حاجة تانية بنفس الهوية البصرية.

## الألوان — الوضع الفاتح (افتراضي)

```
page (خلفية الصفحة):        #eef2f8
surface-1 (كروت/جداول):     #ffffff
surface-2 (خطوط متبادلة):   #f4f7fb
surface-3 (hover):          #e6ecf5

text-primary:                #0f1720
text-secondary:              #4c5a6c
text-muted:                  #78879a

gridline (حدود خفيفة):       #dde5ef
border:                      rgba(15, 23, 32, 0.10)

brand (أساسي):                #1e5fbf
brand-hover:                  #1a54a9
brand-soft (خلفية فاتحة):    #dfe9fb
brand-ink (نص على الأساسي):  #14407f

teal (ثانوي):                 #12876f
teal-soft:                    #d6efe8
violet (تالت):                #5b4bc4
violet-soft:                  #e4e0fa

good (نجاح):                  #17784a
good-soft:                    #d8f0e2
warning (تحذير):              #a76a00
warning-soft:                 #fbeed3
critical (خطأ/حرج):           #c0392b
critical-soft:                #fbdedb
```

## الألوان — الوضع الغامق

```
page:            #0e131a
surface-1:       #161d27
surface-2:       #1c2531
surface-3:       #243040

text-primary:    #eaf0f7
text-secondary:  #a4b2c4
text-muted:      #75849a

gridline:        #263141
border:          rgba(234, 240, 247, 0.12)

brand:           #74a6f5
brand-hover:     #8db8f8
brand-soft:      #1a2c47
brand-ink:       #b9d3fb

teal:            #4ecfae
teal-soft:       #14342c
violet:          #a99cf0
violet-soft:     #241f42

good:            #4cc98a
good-soft:       #12301f
warning:         #e0a53c
warning-soft:    #33260c
critical:        #f08279
critical-soft:   #3a1c1a
```

**قاعدة الاستخدام**: `brand` (الأزرق) للأكشن الأساسي والتحديد الحالي بس — مش للزينة. `teal`/`violet` لتفرقة الفئات بصريًا (زي أعمدة الحالة). الألوان الدلالية (good/warning/critical) منفصلة تمامًا عن الأزرق الأساسي، بتُستخدم بصيغة soft+ink (خلفية فاتحة + نص غامق من نفس العيلة اللونية) في الشارات (badges) والتنبيهات.

## الخط

- **العائلة**: IBM Plex Sans Arabic (self-hosted, مش من CDN) — سقوط احتياطي: `system-ui, -apple-system, "Segoe UI", sans-serif`
- **الأوزان**: 400 (عادي)، 600-700 (شبه بولد/بولد)
- **حجم الأساس**: 15px على الـ body، line-height 1.55
- **جداول البيانات**: 15.5px للخلايا، 14px للهيدر (مموّه بلون `text-muted`، بولد، من غير حروف كبيرة أو تباعد حروف — الخط العربي متصل والتباعد بيبوّظ شكل الحروف)
- **الأرقام**: `font-variant-numeric: tabular-nums` في كل مكان بيتحط فيه بيانات رقمية، عشان الأرقام تتراصف صح في الأعمدة.
- **العناوين**: `letter-spacing: -0.011em` و`text-wrap: balance`

## القياسات (Radius / Shadow)

```
radius-sm:  8px   (أزرار، حقول إدخال)
radius:     12px  (كروت، جداول)
radius-lg:  16px  (كارت تسجيل الدخول)

shadow-sm:  0 1px 2px rgba(15,23,32,.06), 0 1px 1px rgba(15,23,32,.04)
shadow-md:  0 4px 12px rgba(15,23,32,.08), 0 1px 3px rgba(15,23,32,.05)
shadow-lg:  0 16px 40px rgba(15,23,32,.16), 0 4px 12px rgba(15,23,32,.08)
```

الظل غامق ومرفوع (offset + blur حقيقيين)، مش زخرفة مسطحة — نفس القيم بتتكرر في الوضع الغامق بس بـ `rgba(0,0,0,...)` بدل `rgba(15,23,32,...)`.

## المكوّنات الأساسية

**الكارت (`.card` / `.tile`)**: خلفية `surface-1`، حد `gridline` 1px، `radius`، `shadow-sm`. الـ tile (بطاقة إحصائية) فيها رقم كبير بولد (26px) + label صغير مموّه، وشريط لوني رفيع (3px) على الحافة الجانبية يوضح الحالة (اختياري).

**الجدول**: هيدر مموّه ثابت (`position: sticky`)، خطوط صفوف متبادلة خفيفة (`nth-child(even)` بلون `surface-2`)، hover أوضح (`surface-3`)، صف محدد بلون `brand-soft`.

**الشارة (`.badge`)**: بيل مستدير تمامًا (`border-radius: 999px`)، padding صغير، خلفية `*-soft` ونص `*` من نفس اللون الدلالي.

**الزرار**: `radius-sm`، حد رفيع، خلفية `surface-1` (ثانوي) أو `brand` (أساسي، نص أبيض). Hover بيغيّر الخلفية بس (140ms transition)، مفيش أي حركة/تكبير.

**الـ Sidebar**: عرض ثابت 252px، خلفية `surface-1`، مقسّم لمجموعات بعناوين صغيرة uppercase مموّهة (اللغة الإنجليزية بس، مش العربي).

## قواعد عامة

- **RTL بالكامل** — كل الاتجاهات بـ logical properties (`inset-inline-start`, `border-inline-end`) مش `left`/`right` مباشرة.
- **حركة واحدة بس مقصودة**: دخول الصفحة الجديدة (fade + slide خفيف، 320ms) — مفيش حركة تانية زيادة في أي مكان.
- **الوضع الغامق مش انعكاس تلقائي** — كل لون اتصمم لوحده في الغامق (أزرق أفتح شوية، خلفية كحلي مش أسود خالص).
