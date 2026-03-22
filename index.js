const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

// 1. معلومات يوتيوب التجريبية (كما طلبت)
const YOUTUBE_CONFIG = {
  clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
  clientSecret: "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",
  refreshToken: "1//0402McOnnSfYTCgYIARAAGAQSNwF-L9IrHIeF6t-siXlEk4OREx_1gtOf8_8qEdHq3kDNHMnWpOMWyomF6FndgZvgiFwGYMyAwd4"
};

// تهيئة اتصال يوتيوب
const oauth2Client = new google.auth.OAuth2(YOUTUBE_CONFIG.clientId, YOUTUBE_CONFIG.clientSecret);
oauth2Client.setCredentials({ refresh_token: YOUTUBE_CONFIG.refreshToken });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// 2. الحسابات وملف السجل
const tiktokAccounts = [
    'https://www.tiktok.com/@films2026_', // ضع حساباتك هنا
    'https://www.tiktok.com/@sekaleahmed'
];
const DB_FILE = 'history.json';

async function runKiroBot() {
    // جلب السجل الحالي
    let publishedVideos = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];

    // اختيار حساب عشوائي في كل تشغيلة
    const randomAccount = tiktokAccounts[Math.floor(Math.random() * tiktokAccounts.length)];
    console.log(`تم اختيار الحساب العشوائي: ${randomAccount}`);

    try {
        // 3. جلب كل الفيديوهات في الحساب (yt-dlp يجلبها تلقائياً من الأحدث للأقدم)
        console.log("جاري فحص قائمة الفيديوهات بالتسلسل...");
        // شلنا الـ limit عشان يفحص الحساب كامل إذا لزم الأمر
        const output = execSync(`yt-dlp --get-id "${randomAccount}"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
        const videoIds = output.trim().split('\n').filter(id => id.length > 0);

        let videoToUpload = null;

        // 4. الفحص التسلسلي الدقيق (من الأحدث للذي قبله للذي قبله...)
        for (const id of videoIds) {
            if (!publishedVideos.includes(id)) {
                videoToUpload = id;
                break; // بمجرد إيجاد أول فيديو غير منشور، يتوقف البحث فوراً
            }
        }

        // 5. حالة: كل الفيديوهات منشورة
        if (!videoToUpload) {
            console.log("العملية ناجحة: جميع فيديوهات هذا الحساب تم نشرها مسبقاً. لا يوجد شيء جديد لنشره.");
            return; // إنهاء السكربت بسلام
        }

        console.log(`تم العثور على فيديو غير منشور: ${videoToUpload}`);
        console.log("جاري التحميل...");
        execSync(`yt-dlp -f "best" -o "input.mp4" "https://www.tiktok.com/@any/video/${videoToUpload}"`);

        // 6. المعالجة بـ FFmpeg (معالجة البصمة وتطبيق زوم 125%)
        console.log("جاري معالجة الفيديو بـ FFmpeg...");
        execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.25:ih*1.25,crop=iw/1.25:ih/1.25" -c:v libx264 -crf 20 -c:a aac -y output.mp4`);

        // 7. الرفع المباشر ليوتيوب
        console.log("جاري النشر على يوتيوب مباشرة...");
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: 'فيديو حصري جديد 🔥 #Shorts', // العنوان
                    description: 'أفضل المقاطع اليومية، لا تنسى الاشتراك! #ترند #تيك_توك #Shorts', // الوصف
                    tags: ['Shorts', 'Trend', 'TikTok', 'فيديو'], // الكلمات المفتاحية
                    categoryId: '22'
                },
                status: {
                    privacyStatus: 'public', // ينشر للعلن مباشرة
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream('output.mp4')
            }
        });

        console.log(`تم النشر بنجاح! الرابط: https://youtu.be/${res.data.id}`);

        // 8. تسجيل الفيديو في القاعدة حتى لا يتكرر
        publishedVideos.push(videoToUpload);
        fs.writeFileSync(DB_FILE, JSON.stringify(publishedVideos, null, 2));

        // تنظيف الملفات
        if (fs.existsSync('input.mp4')) fs.unlinkSync('input.mp4');
        if (fs.existsSync('output.mp4')) fs.unlinkSync('output.mp4');

    } catch (error) {
        console.error("حدث خطأ أثناء التنفيذ:", error.message);
    }
}

runKiroBot();
