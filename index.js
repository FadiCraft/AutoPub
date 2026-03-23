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
const PROCESSED_FILE = 'processed_videos.json'; // ملف منفصل للفيديوهات المعالجة

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
        const searchRes = await youtube.search.list({
            part: 'id',
            forMine: true,
            type: 'video',
            maxResults: 2,
            order: 'date'
        });

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

// --- دالة جديدة لجلب جميع فيديوهات التيك توك ---
async function getAllTikTokVideos(accountUrl) {
    console.log(`📋 جلب جميع فيديوهات التيك توك من: ${accountUrl}`);
    
    try {
        // جلب جميع معرفات الفيديوهات من الحساب
        const idsOutput = execSync(`yt-dlp --get-id --flat-playlist "${accountUrl}"`, { 
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024 // زيادة البفر لاستيعاب عدد كبير من الفيديوهات
        });
        
        const videoIds = idsOutput.trim().split('\n').filter(id => id.length > 0);
        console.log(`✅ تم العثور على ${videoIds.length} فيديو في الحساب`);
        
        // ترتيب الفيديوهات من الأقدم إلى الأحدث (أو العكس حسب رغبتك)
        // هنا سنعكس الترتيب ليكون من الأقدم للأحدث
        const orderedVideos = videoIds.reverse();
        
        return orderedVideos;
    } catch (error) {
        console.error(`❌ خطأ في جلب فيديوهات التيك توك: ${error.message}`);
        return [];
    }
}

// --- دالة لتحميل ونشر فيديو واحد ---
async function processVideo(videoId, accountIndex, videoIndex, totalVideos) {
    console.log(`\n📹 [${videoIndex + 1}/${totalVideos}] بدء معالجة الفيديو: ${videoId}`);
    
    let title = "مشهد رائع من كيرو زوزو 🔥";
    try {
        title = execSync(`yt-dlp --get-title "https://www.tiktok.com/@any/video/${videoId}"`, { 
            encoding: 'utf-8' 
        }).trim().replace(/#\w+/g, '');
    } catch(e) {
        console.log(`⚠️ تعذر جلب العنوان، سيتم استخدام العنوان الافتراضي`);
    }
    
    console.log(`🎬 عنوان الفيديو: ${title.substring(0, 50)}...`);
    
    // تحميل الفيديو
    console.log("⬇️ جاري التحميل...");
    execSync(`yt-dlp -f "bestvideo[height<=1080]+bestaudio/best" -o "input_${videoId}.mp4" "https://www.tiktok.com/@any/video/${videoId}"`);
    
    // معالجة احترافية
    console.log("🛠️ جاري المعالجة...");
    execSync(`ffmpeg -i input_${videoId}.mp4 -vf "scale=iw*1.25:ih*1.25,crop=iw/1.25:ih/1.25,eq=brightness=0.01:contrast=1.03" -map_metadata -1 -c:v libx264 -crf 23 -c:a aac -y output_${videoId}.mp4`);
    
    // رفع الفيديو
    console.log("📤 جاري الرفع إلى اليوتيوب...");
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
        media: { body: fs.createReadStream(`output_${videoId}.mp4`) }
    });
    
    const newYtId = uploadRes.data.id;
    console.log(`✅ تم النشر بنجاح: https://youtu.be/${newYtId}`);
    
    // إضافة التعليق
    console.log("⏳ انتظار 60 ثوانٍ قبل إضافة التعليق...");
    await delay(60000);
    
    const proComment = `لمزيد من المحتوى زورونا على  ${MY_SITE}\n\n` +
                       `🔥 تابعوا كيرو زوزو - kirozozo للمزيد من المتعة!\n` +
                       `✨ لا تنسوا اللايك والاشتراك يا أساطير ❤️`;
    
    await postComment(newYtId, proComment);
    
    // تنظيف الملفات المؤقتة
    [`input_${videoId}.mp4`, `output_${videoId}.mp4`].forEach(f => { 
        if(fs.existsSync(f)) fs.unlinkSync(f); 
    });
    
    return { videoId, published: true, youtubeId: newYtId, title };
}

// --- المحرك الرئيسي المحسن ---
async function startKiroSystem() {
    // قراءة قائمة الفيديوهات المنشورة سابقاً
    let publishedVideos = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
    let processedVideos = fs.existsSync(PROCESSED_FILE) ? JSON.parse(fs.readFileSync(PROCESSED_FILE)) : [];
    
    console.log(`📊 تم نشر ${publishedVideos.length} فيديو مسبقاً`);
    
    // المعالجة لكل حساب تيك توك
    for (let accIndex = 0; accIndex < tiktokAccounts.length; accIndex++) {
        const account = tiktokAccounts[accIndex];
        console.log(`\n🚀 بدء العمل على حساب تيك توك ${accIndex + 1}/${tiktokAccounts.length}: ${account}`);
        
        // جلب جميع فيديوهات التيك توك
        const allVideos = await getAllTikTokVideos(account);
        
        if (allVideos.length === 0) {
            console.log(`⚠️ لا توجد فيديوهات في هذا الحساب`);
            continue;
        }
        
        // تصفية الفيديوهات التي لم تنشر بعد
        const newVideos = allVideos.filter(videoId => !publishedVideos.includes(videoId));
        
        console.log(`📊 فيديوهات جديدة للنشر: ${newVideos.length} من أصل ${allVideos.length}`);
        
        if (newVideos.length === 0) {
            console.log(`✅ جميع فيديوهات هذا الحساب تم نشرها مسبقاً`);
            continue;
        }
        
        // نشر جميع الفيديوهات الجديدة بالترتيب
        for (let i = 0; i < newVideos.length; i++) {
            const videoId = newVideos[i];
            
            try {
                // نشر الفيديو
                const result = await processVideo(videoId, accIndex, i, newVideos.length);
                
                if (result.published) {
                    // تحديث قائمة الفيديوهات المنشورة
                    publishedVideos.push(videoId);
                    fs.writeFileSync(DB_FILE, JSON.stringify(publishedVideos, null, 2));
                    
                    // حفظ تفاصيل المعالجة
                    processedVideos.push({
                        ...result,
                        account: account,
                        publishedAt: new Date().toISOString()
                    });
                    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processedVideos, null, 2));
                    
                    console.log(`✅ [${i + 1}/${newVideos.length}] تم نشر الفيديو بنجاح`);
                    
                    // فحص حالة الفيديو السابق بعد كل نشر
                    await checkPreviousVideoStatus();
                    
                    // انتظار بين الفيديوهات لتجنب مشاكل الـ API
                    if (i < newVideos.length - 1) {
                        console.log(`⏳ انتظار 5 دقائق قبل نشر الفيديو التالي...`);
                        await delay(300000); // 5 دقائق بين كل فيديو وآخر
                    }
                }
                
            } catch (error) {
                console.error(`❌ فشل نشر الفيديو ${videoId}: ${error.message}`);
                // في حالة الفشل، انتظر قبل المحاولة التالية
                await delay(60000);
                continue;
            }
        }
        
        // انتظار بين الحسابات المختلفة
        if (accIndex < tiktokAccounts.length - 1) {
            console.log(`\n⏳ انتظار 10 دقائق قبل الانتقال للحساب التالي...`);
            await delay(600000);
        }
    }
    
    console.log(`\n🎉 اكتملت عملية نشر جميع الفيديوهات بنجاح!`);
    console.log(`📊 ملخص النشر: ${publishedVideos.length} فيديو منشور في المجمل`);
}

// تشغيل النظام
startKiroSystem().catch(error => {
    console.error("❌ خطأ عام في النظام:", error.message);
});
