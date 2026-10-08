# Kamirty Motion — الحزمة التأسيسية للمشروع

**الإصدار:** 0.1 (تصميم أولي، لا يحتوي على محرك فيديو جاهز)
**التاريخ:** 8 أكتوبر 2026
**الهدف:** منصة ويب مستقلة مجانية للزائر لتحويل الوصف العربي إلى فيديو إنفوجرافيك متحرك مدته 120 ثانية؛ الربط ببلوجر يكون عبر رابط مباشر بعد النشر.

## ابدأ من هنا

1. اقرأ `docs/PRODUCT_BRIEF_AR.md` لفهم المنتج وحدوده ومراحل تنفيذه.
2. اقرأ `docs/TECHNICAL_ARCHITECTURE_AR.md` للمكونات وعقد البيانات المشترك.
3. اقرأ `docs/TEST_PLAN_AR.md` قبل كتابة محرك التصدير.
4. ضع `CLAUDE.md` في جذر مستودع GitHub نفسه ليقرأ Claude Code التعليمات تلقائيًا.
5. أعطِ Claude Code الطلب المحدد في `prompts/CLAUDE_FIRST_TASK_AR.md` فقط، ولا تطلب بناء المنتج بالكامل دفعة واحدة.
6. استخدم `schemas/project.v1.schema.json` كبداية لعقد المشروع وقم بتعديله بإصدارات توافقية فقط.

## مبادئ ثابتة

- تشغيل محلي داخل المتصفح، بلا API مدفوع لكل فيديو.
- لا حسابات، لا تخزين ملفات أو أوصاف الزوار في خوادمنا.
- معاينة وتصدير يستندان إلى **نفس محرك رسم الإطارات**.
- العربية وRTL بشكل صحيح، مع دعم الأرقام والكلمات الإنجليزية في النص العربي.
- الإطار الزمني 120 ثانية ثابت؛ عند 30fps = 3600 إطار.
- تجربة تصدير MP4 مشروطة بتوفر الترميزات، وبديل WebM عند الحاجة.
- أي ميزة تضيف تكلفة أو اتصالًا خارجيًا تحتاج موافقة صريحة قبل إضافتها.

## مراجع رسمية

- Mediabunny: https://mediabunny.dev/guide/quick-start
- WebCodecs/VideoEncoder: https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder
- Canvas RTL: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/direction
- Cloudflare Pages: https://developers.cloudflare.com/pages/functions/pricing/
- Cloudflare Pages domain: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Claude Code project instructions: https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts
