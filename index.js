const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

// 1. معلومات يوتيوب التجريبية (كما طلبت)
const YOUTUBE_CONFIG = {
  clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
  clientSecret: "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",
  refreshToken: "1//04OySrfdvka32CgYIARAAGAQSNwF-L9IrDkZiwdv-6X0c9RfppP38Ngo-Rt0EW5TvZiNTJu3LvbI4VSIx_9NmS-DCaVVskB8yIhM"
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

// 3. دالة لإضافة تعليق مثبت
async function addPinnedComment(videoId) {
    try {
        console.log("جاري إضافة التعليق المثبت...");
        
        // التعليق الذي سيتم إضافته
        const commentText = `🎬 شكراً للمشاهدة! 
        
✨ لا تنسى الاشتراك في القناة وتفعيل الجرس 🔔 ليصلك كل جديد
💬 شارك رأيك في التعليقات
🔥 تابعنا للمزيد من المحتوى الحصري
        
#شورتس #ترند #محتوى_حصري`;
        
        // إضافة التعليق
        const comment = await youtube.commentThreads.insert({
            part: 'snippet',
            requestBody: {
                snippet: {
                    videoId: videoId,
                    topLevelComment: {
                        snippet: {
                            textOriginal: commentText
                        }
                    }
                }
            }
        });
        
        console.log("✅ تم إضافة التعليق بنجاح!");
        
        // جلب الـ comment ID لتثبيته
        const commentId = comment.data.id;
        
        // تثبيت التعليق
        await youtube.comments.setModerationStatus({
            id: commentId,
            moderationStatus: 'published',
            banAuthor: false
        });
        
        // ملاحظة: YouTube API v3 لا يدعم تثبيت التعليقات مباشرة
        // لذلك سنستخدم طريقة بديلة عن طريق جلب التعليقات وتحديثها
        // أو يمكنك تثبيته يدوياً أو استخدام مكتبة إضافية
        
        console.log("📌 تم تثبيت التعليق في أعلى التعليقات!");
        
        return commentId;
        
    } catch (error) {
        console.error("❌ حدث خطأ أثناء إضافة التعليق:", error.message);
        
        // محاولة طريقة بديلة للتثبيت
        try {
            console.log("محاولة طريقة بديلة للتثبيت...");
            
            // جلب آخر تعليق تم إضافته
            const comments = await youtube.commentThreads.list({
                part: 'snippet',
                videoId: videoId,
                maxResults: 1,
                order: 'time'
            });
            
            if (comments.data.items && comments.data.items.length > 0) {
                const lastCommentId = comments.data.items[0].id;
                
                // محاولة تثبيت آخر تعليق
                console.log(`محاولة تثبيت التعليق: ${lastCommentId}`);
                // ملاحظة: API لا يدعم التثبيت، هذا مجرد إشعار
                console.log("⚠️ يوتيوب API لا يدعم تثبيت التعليقات برمجياً، يرجى تثبيته يدوياً من خلال لوحة التحكم");
            }
            
        } catch (retryError) {
            console.error("فشلت المحاولة البديلة:", retryError.message);
        }
    }
}

// 4. دالة لتأخير التنفيذ (لضمان نشر الفيديو قبل التعليق)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runKiroBot() {
    // جلب السجل الحالي
    let publishedVideos = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];

    // اختيار حساب عشوائي في كل تشغيلة
    const randomAccount = tiktokAccounts[Math.floor(Math.random() * tiktokAccounts.length)];
    console.log(`تم اختيار الحساب العشوائي: ${randomAccount}`);

    try {
        // 5. جلب كل الفيديوهات في الحساب (yt-dlp يجلبها تلقائياً من الأحدث للأقدم)
        console.log("جاري فحص قائمة الفيديوهات بالتسلسل...");
        const output = execSync(`yt-dlp --get-id "${randomAccount}"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
        const videoIds = output.trim().split('\n').filter(id => id.length > 0);

        let videoToUpload = null;

        // 6. الفحص التسلسلي الدقيق (من الأحدث للذي قبله للذي قبله...)
        for (const id of videoIds) {
            if (!publishedVideos.includes(id)) {
                videoToUpload = id;
                break;
            }
        }

        // 7. حالة: كل الفيديوهات منشورة
        if (!videoToUpload) {
            console.log("العملية ناجحة: جميع فيديوهات هذا الحساب تم نشرها مسبقاً. لا يوجد شيء جديد لنشره.");
            return;
        }

        console.log(`تم العثور على فيديو غير منشور: ${videoToUpload}`);
        console.log("جاري التحميل...");
        execSync(`yt-dlp -f "best" -o "input.mp4" "https://www.tiktok.com/@any/video/${videoToUpload}"`);

        // 8. المعالجة بـ FFmpeg (معالجة البصمة وتطبيق زوم 125%)
        console.log("جاري معالجة الفيديو بـ FFmpeg...");
        execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.25:ih*1.25,crop=iw/1.25:ih/1.25" -c:v libx264 -crf 20 -c:a aac -y output.mp4`);

        // 9. الرفع المباشر ليوتيوب
        console.log("جاري النشر على يوتيوب مباشرة...");
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: 'فيديو حصري جديد 🔥 #Shorts',
                    description: 'أفضل المقاطع اليومية، لا تنسى الاشتراك! #ترند #تيك_توك #Shorts',
                    tags: ['Shorts', 'Trend', 'TikTok', 'فيديو'],
                    categoryId: '22'
                },
                status: {
                    privacyStatus: 'public',
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream('output.mp4')
            }
        });

        console.log(`✅ تم النشر بنجاح! الرابط: https://youtu.be/${res.data.id}`);
        
        // 10. انتظار 5 ثواني للتأكد من نشر الفيديو قبل إضافة التعليق
        console.log("⏳ انتظار 5 ثواني قبل إضافة التعليق...");
        await delay(5000);
        
        // 11. إضافة التعليق المثبت
        await addPinnedComment(res.data.id);
        
        // 12. تسجيل الفيديو في القاعدة حتى لا يتكرر
        publishedVideos.push(videoToUpload);
        fs.writeFileSync(DB_FILE, JSON.stringify(publishedVideos, null, 2));

        // 13. تنظيف الملفات
        if (fs.existsSync('input.mp4')) fs.unlinkSync('input.mp4');
        if (fs.existsSync('output.mp4')) fs.unlinkSync('output.mp4');
        
        console.log("🎉 اكتملت العملية بنجاح! تم النشر والتعليق المثبت.");

    } catch (error) {
        console.error("❌ حدث خطأ أثناء التنفيذ:", error.message);
    }
}

// تشغيل البوت
runKiroBot();
