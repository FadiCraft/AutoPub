const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

// إعدادات اليوتيوب من الـ Environment Variables
const youtube = google.youtube({
    version: 'v3',
    auth: new google.auth.OAuth2(
        process.env.YT_CLIENT_ID,
        process.env.YT_CLIENT_SECRET,
        'http://localhost'
    )
});

async function run() {
    try {
        const videoUrl = "رابط_فيديو_تيكتوك_هنا"; // ممكن تخليه متغير أو يقرأ من ملف
        
        // 1. تحميل الفيديو بدون علامة مائية باستخدام yt-dlp
        console.log("جاري تحميل الفيديو من تيكتوك...");
        execSync(`yt-dlp -f "best" -o "input.mp4" "${videoUrl}"`);

        // 2. تعديل بسيط بـ FFmpeg لتغيير الـ Hash (عشان يوتيوب ما يعتبره مكرر)
        // رح نغير الحجم لـ 1081x1921 بزيادة بكسل واحد فقط
        console.log("جاري معالجة الفيديو...");
        execSync(`ffmpeg -i input.mp4 -vf "scale=1081:1921" -c:v libx264 -crf 18 output.mp4`);

        // 3. الرفع لليوتيوب (YouTube Shorts)
        console.log("جاري الرفع إلى يوتيوب...");
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: 'فيديو جديد من تيكتوك #Shorts',
                    description: 'تم الرفع تلقائياً بواسطة Kiro Auto Bot',
                    tags: ['Shorts', 'TikTok', 'Automation'],
                    categoryId: '22' // Category: People & Blogs
                },
                status: {
                    privacyStatus: 'public', // أو 'private' للتجربة
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream('output.mp4')
            }
        });

        console.log(`تم الرفع بنجاح! رابط الفيديو: https://youtu.be/${res.data.id}`);

    } catch (error) {
        console.error("حدث خطأ:", error);
    }
}

// تشغيل السكربت
run();
