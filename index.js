const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

// --- 1. الإعدادات الأساسية ---
const YOUTUBE_CONFIG = {
    clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04OySrfdvka32CgYIARAAGAQSNwF-L9IrDkZiwdv-6X0c9RfppP38Ngo-Rt0EW5TvZiNTJu3LvbI4VSIx_9NmS-DCaVVskB8yIhM"
};

const MY_SITE = "كيرو زوزو ";
const DB_FILE = 'history.json';

const tiktokAccounts = [
    'https://www.tiktok.com/@films2026_',
    'https://www.tiktok.com/@adeyu_77'
];

const oauth2Client = new google.auth.OAuth2(YOUTUBE_CONFIG.clientId, YOUTUBE_CONFIG.clientSecret);
oauth2Client.setCredentials({ refresh_token: YOUTUBE_CONFIG.refreshToken });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- 2. دوال الحماية الذكية ---

// فحص الفيديو السابق مباشرة (اللي قبل اللي نشرناه هسا)
async function checkPreviousVideoStatus() {
    console.log("🛡️ جاري فحص الفيديو السابق للتأكد من سلامته...");
    try {
        // جلب آخر فيديوهين من القناة
        const searchRes = await youtube.search.list({
            part: 'id',
            forMine: true,
            type: 'video',
            maxResults: 2, // نأخذ 2 لنجد الفيديو السابق
            order: 'date'
        });

        // الفيديو السابق هو الثاني في القائمة (index 1)
        const previousVideoId = searchRes.data.items[1]?.id?.videoId;

        if (!previousVideoId) {
            console.log("ℹ️ لا يوجد فيديو سابق لفحصه بعد.");
            return;
        }

        const res = await youtube.videos.list({
            part: 'status,snippet',
            id: previousVideoId
        });

        const video = res.data.items[0];
        if (video) {
            const isRejected = video.status.uploadStatus === 'rejected';
            const hasClaim = video.status.rejectionReason === 'claim' || video.status.rejectionReason === 'copyright';

            if (isRejected && hasClaim) {
                console.log(`⚠️ تم كشف حقوق نشر على الفيديو السابق: ${video.snippet.title}`);
                await youtube.videos.delete({ id: previousVideoId });
                console.log(`🗑️ تم الحذف بنجاح لتنظيف القناة.`);
            } else {
                console.log(`✅ الفيديو السابق سليم تماماً.`);
            }
        }
    } catch (e) {
        console.log("ℹ️ تنبيه أثناء فحص الفيديو السابق: " + e.message);
    }
}

function buildProDescription(title) {
    return `🎬 كيرو زوزو | KiroZozo - عالم الأفلام والمسلسلات\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `💡 للمزيد من التفاصيل:\n` +
           `🔍 ابحث في جوجل: ${MY_SITE}\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
           `✨ نبذة عن هذا المقطع:\n` +
           `${title || "لقطة مميزة مختارة لكم بعناية"}\n\n` +
           `💡 لا تنسى دعمنا بالاشتراك وتفعيل الجرس (🔔) ليصلك كل جديد من كيرو زوزو.\n\n` +
           `🏷️ #kirozozo #كيرو_زوزو #أفلام #مسلسلات #Shorts #Movies #Trend`;
}

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
        console.log(`💬 تم إضافة التعليق بنجاح.`);
        return true;
    } catch (e) {
        console.error(`❌ فشل التعليق: ${e.message}`);
        return false;
    }
}

// --- 3. المحرك الأساسي ---

async function startKiroSystem() {
    let publishedVideos = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
    const account = tiktokAccounts[Math.floor(Math.random() * tiktokAccounts.length)];
    
    console.log(`🚀 بدء العمل على حساب: ${account}`);

    try {
        const idsOutput = execSync(`yt-dlp --get-id --playlist-items 10 "${account}"`, { encoding: 'utf-8' });
        const videoIds = idsOutput.trim().split('\n').filter(id => id.length > 0);
        let targetId = videoIds.find(id => !publishedVideos.includes(id));

        if (targetId) {
            console.log(`✨ فيديو جديد مكتشف من تيك توك: ${targetId}`);
            
            let title = "مشهد رائع من كيرو زوزو 🔥";
            try {
                title = execSync(`yt-dlp --get-title "https://www.tiktok.com/@any/video/${targetId}"`, { encoding: 'utf-8' }).trim().replace(/#\w+/g, '');
            } catch(e) {}

            console.log("⬇️ تحميل ومعالجة...");
            execSync(`yt-dlp -f "bestvideo[height<=1080]+bestaudio/best" -o "input.mp4" "https://www.tiktok.com/@any/video/${targetId}"`);
            
            // معالجة احترافية (زوم 125% + مسح ميتاداتا)
            execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.25:ih*1.25,crop=iw/1.25:ih/1.25,eq=brightness=0.01:contrast=1.03" -map_metadata -1 -c:v libx264 -crf 23 -c:a aac -y output.mp4`);

            console.log("📤 رفع الفيديو الجديد...");
            const uploadRes = await youtube.videos.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: {
                        title: `${title.substring(0, 70)} 🔥 #kirozozo`,
                        description: buildProDescription(title),
                        tags: ['kirozozo', 'كيرو زوزو', 'أفلام', 'Shorts'],
                        categoryId: '24' 
                    },
                    status: { privacyStatus: 'public' }
                },
                media: { body: fs.createReadStream('output.mp4') }
            });

            const newYtId = uploadRes.data.id;
            console.log(`✅ تم النشر: https://youtu.be/${newYtId}`);

            publishedVideos.push(targetId);
            fs.writeFileSync(DB_FILE, JSON.stringify(publishedVideos, null, 2));

            // --- التعديل المطلوب هنا ---
            // فحص الفيديو الذي نشرناه في المرة السابقة فقط
            await checkPreviousVideoStatus();

            // إضافة التعليق على الفيديو الحالي
            console.log("⏳ انتظار 60 ثوانٍ للتعليق...");
            await delay(60000);
            
            const proComment = `لمزيد من المحتوى زورونا على  ${MY_SITE}\n\n` +
                               `🔥 تابعوا كيرو زوزو - kirozozo للمزيد من المتعة!\n` +
                               `✨ لا تنسوا اللايك والاشتراك يا أساطير ❤️`;
            
            await postComment(newYtId, proComment);

        } else {
            console.log("ℹ️ لا يوجد جديد، سيتم الاكتفاء بفحص الفيديو الأخير فقط.");
            await checkPreviousVideoStatus();
        }

    } catch (error) {
        console.error("⚠️ خطأ في النظام:", error.message);
    } finally {
        ['input.mp4', 'output.mp4'].forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f); });
    }
}

startKiroSystem();
