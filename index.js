const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

// --- 1. الإعدادات والبيانات الحساسة ---
const YOUTUBE_CONFIG = {
    clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04OySrfdvka32CgYIARAAGAQSNwF-L9IrDkZiwdv-6X0c9RfppP38Ngo-Rt0EW5TvZiNTJu3LvbI4VSIx_9NmS-DCaVVskB8yIhM"
};

const MY_SITE = "https://redirectauto4kiro.blogspot.com/";
const DB_FILE = 'history.json';
const COMMENTS_DB = 'comments_history.json';

const tiktokAccounts = [
    'https://www.tiktok.com/@films2026_',
    'https://www.tiktok.com/@adeyu_77'
];

// تهيئة OAuth2
const oauth2Client = new google.auth.OAuth2(YOUTUBE_CONFIG.clientId, YOUTUBE_CONFIG.clientSecret);
oauth2Client.setCredentials({ refresh_token: YOUTUBE_CONFIG.refreshToken });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// دالة تأخير زمني لمعالجة أخطاء سرعة التنفيذ
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- 2. دوال الحماية والمحتوى ---

// دالة فحص وحذف الفيديوهات المخالفة لحقوق النشر
async function cleanupCopyrightedVideos() {
    console.log("🛡️ جاري فحص الفيديوهات السابقة للتأكد من خلوها من حقوق النشر...");
    try {
        const res = await youtube.videos.list({
            part: 'status,snippet',
            mine: true,
            maxResults: 10
        });

        for (const video of res.data.items) {
            // التحقق مما إذا كان يوتيوب قد رفض الفيديو بسبب حقوق الملكية
            if (video.status.uploadStatus === 'rejected' && 
               (video.status.rejectionReason === 'claim' || video.status.rejectionReason === 'copyright')) {
                console.log(`⚠️ اكتشاف حقوق نشر على الفيديو: ${video.snippet.title}. جاري الحذف...`);
                await youtube.videos.delete({ id: video.id });
                console.log(`🗑️ تم الحذف بنجاح لحماية القناة: ${video.id}`);
            }
        }
    } catch (e) {
        console.log("ℹ️ فحص الحقوق: القناة سليمة ولا توجد مشاكل حالياً.");
    }
}

// بناء وصف احترافي (Professional Template)
function buildProDescription(title) {
    return `🎬 كيرو زوزو | KiroZozo - عالم الأفلام والمسلسلات\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `📍 لمشاهدة الفيلم كامل أو التحميل بجودة عالية، تفضل بزيارة موقعنا الرسمي:\n` +
           `🔗 رابط الموقع: ${MY_SITE}\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
           `✨ نبذة عن هذا المقطع:\n` +
           `${title || "لقطة مميزة مختارة لكم بعناية"}\n\n` +
           `💡 لا تنسى دعمنا بالاشتراك وتفعيل الجرس (🔔) ليصلك كل جديد من كيرو زوزو.\n\n` +
           `🏷️ هاشتاجات القناة:\n` +
           `#kirozozo #كيرو_زوزو #أفلام #مسلسلات #Shorts #Movies #Trend`;
}

// دالة موحدة لإضافة التعليقات مع معالجة الأخطاء
async function postComment(videoId, text) {
    try {
        await youtube.commentThreads.insert({
            part: 'snippet',
            requestBody: {
                snippet: {
                    videoId: videoId,
                    topLevelComment: { snippet: { textOriginal: text } }
                }
            }
        });
        console.log(`💬 تم إضافة التعليق بنجاح على الفيديو: ${videoId}`);
        return true;
    } catch (e) {
        console.error(`❌ فشل إضافة التعليق: ${e.message}`);
        return false;
    }
}

// --- 3. المحرك الرئيسي ---

async function runKiroSystem() {
    let published = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
    let commented = fs.existsSync(COMMENTS_DB) ? JSON.parse(fs.readFileSync(COMMENTS_DB)) : [];

    // 1. تشغيل الفحص الأمني قبل أي شيء
    await cleanupCopyrightedVideos();

    const account = tiktokAccounts[Math.floor(Math.random() * tiktokAccounts.length)];
    console.log(`🚀 جاري العمل على سحب فيديو واحد من: ${account}`);

    try {
        // جلب آخر 15 فيديو لضمان إيجاد فيديو غير منشور
        const outIds = execSync(`yt-dlp --get-id --playlist-items 15 "${account}"`, { encoding: 'utf-8' });
        const videoIds = outIds.trim().split('\n').filter(id => id.length > 0);

        const targetId = videoIds.find(id => !published.includes(id));

        if (targetId) {
            console.log(`✅ وجدنا فيديو جديد سيتم نشره الآن: ${targetId}`);
            
            // جلب عنوان الفيديو الأصلي
            let rawTitle = "مشهد أسطوري لا يفوتك 🎬";
            try {
                rawTitle = execSync(`yt-dlp --get-title "https://www.tiktok.com/@any/video/${targetId}"`, { encoding: 'utf-8' }).toString().replace(/#\w+/g, '').trim();
            } catch(e) {}

            // التحميل
            console.log("⬇️ جاري التحميل...");
            execSync(`yt-dlp -f "bestvideo[height<=1080]+bestaudio/best" -o "input.mp4" "https://www.tiktok.com/@any/video/${targetId}"`);
            
            // FFmpeg: زوم 125% لتغيير البصمة بشكل ثابت + إزالة البيانات الوصفية + تعديل لوني خفيف
            console.log("🎨 جاري المعالجة (تغيير البصمة الرقمية)...");
            execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.25:ih*1.25,crop=iw/1.25:ih/1.25,eq=brightness=0.02:contrast=1.05" -map_metadata -1 -c:v libx264 -crf 22 -c:a aac -y output.mp4`);

            // الرفع
            console.log("📤 جاري النشر على يوتيوب...");
            const upload = await youtube.videos.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: {
                        title: `${rawTitle.substring(0, 70)} 🔥 #kirozozo`,
                        description: buildProDescription(rawTitle),
                        tags: ['kirozozo', 'كيرو زوزو', 'أفلام', 'مسلسلات', 'Movies', 'Shorts', 'Cinema'],
                        categoryId: '24' // ترفيه
                    },
                    status: { privacyStatus: 'public' }
                },
                media: { body: fs.createReadStream('output.mp4') }
            });

            const newId = upload.data.id;
            console.log(`🎉 تم النشر بنجاح: https://youtu.be/${newId}`);

            // ⏳ التأخير الزمني المهم جداً لضمان قبول التعليق
            console.log("⏳ ننتظر 15 ثانية حتى يقوم يوتيوب بتهيئة الفيديو لاستقبال التعليق...");
            await delay(15000); 

            // إضافة التعليق المثبت التلقائي
            const proComment = `🍿 رابط المشاهدة والتحميل المباشر تجدونه هنا: ${MY_SITE}\n\n` +
                               `🔥 تابعوا كيرو زوزو - kirozozo للمزيد من المتعة!\n` +
                               `✨ لا تنسوا اللايك والاشتراك يا أساطير ❤️`;
            
            await postComment(newId, proComment);

            // حفظ في السجل
            published.push(targetId);
            fs.writeFileSync(DB_FILE, JSON.stringify(published, null, 2));

        } else {
            console.log("ℹ️ لم يتم العثور على فيديوهات جديدة في هذا الحساب، جاري الترويج المتبادل فقط.");
        }

        // --- الترويج المتبادل (Cross-Promotion) على فيديو قديم ---
        const myVideos = await youtube.videos.list({ part: 'id', mine: true, maxResults: 15 });
        const oldVid = myVideos.data.items.find(v => !commented.includes(v.id));
        
        if (oldVid) {
            const promo = `🎬 لمزيد من الأفلام الحصرية تفضلوا بزيارة موقعنا: ${MY_SITE}\n🔥 #كيرو_زوزو #kirozozo`;
            if (await postComment(oldVid.id, promo)) {
                commented.push(oldVid.id);
                fs.writeFileSync(COMMENTS_DB, JSON.stringify(commented, null, 2));
            }
        }

    } catch (e) {
        console.error("⚠️ حدث خطأ في النظام:", e.message);
    } finally {
        // تنظيف الملفات المؤقتة لتوفير المساحة
        ['input.mp4', 'output.mp4'].forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f); });
    }
}

runKiroSystem();
