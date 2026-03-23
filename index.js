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
const DB_FILE = 'published_history.json'; // ملف لتسجيل الفيديوهات المنشورة

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

// --- دالة لجلب فيديو واحد جديد فقط (الأقدم أو الأحدث حسب الرغبة) ---
async function getNextVideoToPublish(accountUrl, publishedVideos) {
    console.log(`📋 جلب الفيديوهات من: ${accountUrl}`);
    
    try {
        // جلب جميع معرفات الفيديوهات من الحساب
        const idsOutput = execSync(`yt-dlp --get-id --flat-playlist "${accountUrl}"`, { 
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024
        });
        
        let videoIds = idsOutput.trim().split('\n').filter(id => id.length > 0);
        console.log(`✅ تم العثور على ${videoIds.length} فيديو في الحساب`);
        
        // تصفية الفيديوهات التي لم تنشر بعد
        const newVideos = videoIds.filter(id => !publishedVideos.includes(id));
        console.log(`📊 فيديوهات جديدة غير منشورة: ${newVideos.length}`);
        
        if (newVideos.length === 0) {
            return null;
        }
        
        // اختيار الفيديو الأقدم أولاً (عكس الترتيب)
        // لو حبيت تنشر الأحدث أولاً، امسح الـ reverse()
        const oldestFirst = newVideos.reverse();
        
        console.log(`🎯 سيتم نشر الفيديو: ${oldestFirst[0]}`);
        return oldestFirst[0];
        
    } catch (error) {
        console.error(`❌ خطأ في جلب فيديوهات التيك توك: ${error.message}`);
        return null;
    }
}

// --- دالة لتحميل ونشر فيديو واحد ---
async function publishSingleVideo(videoId, accountUrl) {
    console.log(`\n📹 بدء معالجة الفيديو: ${videoId}`);
    
    let title = "مشهد رائع من كيرو زوزو 🔥";
    try {
        title = execSync(`yt-dlp --get-title "https://www.tiktok.com/@any/video/${videoId}"`, { 
            encoding: 'utf-8' 
        }).trim().replace(/#\w+/g, '');
        console.log(`🎬 عنوان الفيديو: ${title.substring(0, 50)}...`);
    } catch(e) {
        console.log(`⚠️ تعذر جلب العنوان، سيتم استخدام العنوان الافتراضي`);
    }
    
    // تحميل الفيديو
    console.log("⬇️ جاري التحميل...");
    execSync(`yt-dlp -f "bestvideo[height<=1080]+bestaudio/best" -o "input.mp4" "https://www.tiktok.com/@any/video/${videoId}"`);
    
    // معالجة احترافية
    console.log("🛠️ جاري المعالجة بالفلاتر...");
    execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.25:ih*1.25,crop=iw/1.25:ih/1.25,eq=brightness=0.01:contrast=1.03" -map_metadata -1 -c:v libx264 -crf 23 -c:a aac -y output.mp4`);
    
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
        media: { body: fs.createReadStream('output.mp4') }
    });
    
    const newYtId = uploadRes.data.id;
    console.log(`✅ تم النشر بنجاح: https://youtu.be/${newYtId}`);
    
    // إضافة التعليق بعد 60 ثانية
    console.log("⏳ انتظار 120 ثانية قبل إضافة التعليق...");
    await delay(120000);
    
    const proComment = `لمزيد من المحتوى زورونا على  ${MY_SITE}\n\n` +
                       `🔥 تابعوا كيرو زوزو - kirozozo للمزيد من المتعة!\n` +
                       `✨ لا تنسوا اللايك والاشتراك يا أساطير ❤️`;
    
    await postComment(newYtId, proComment);
    
    // تنظيف الملفات المؤقتة
    ['input.mp4', 'output.mp4'].forEach(f => { 
        if(fs.existsSync(f)) fs.unlinkSync(f); 
    });
    
    return { 
        success: true, 
        videoId: videoId, 
        youtubeId: newYtId, 
        title: title,
        account: accountUrl,
        publishedAt: new Date().toISOString()
    };
}

// --- المحرك الرئيسي (ينشر فيديو واحد فقط في كل مرة) ---
async function startKiroSystem() {
    console.log("🚀 بدء تشغيل نظام نشر الفيديوهات (فيديو واحد لكل تشغيلة)");
    console.log("=" .repeat(50));
    
    // قراءة تاريخ الفيديوهات المنشورة
    let publishedVideos = [];
    let fullHistory = [];
    
    if (fs.existsSync(DB_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            if (Array.isArray(data)) {
                // إذا كان الملف عبارة عن مصفوفة بسيطة (للتوافق مع القديم)
                publishedVideos = data;
                fullHistory = data.map(id => ({ videoId: id }));
            } else if (data.publishedVideos) {
                // إذا كان الملف يحتوي على هيكل متقدم
                publishedVideos = data.publishedVideos || [];
                fullHistory = data.history || [];
            }
            console.log(`📊 تم استعادة سجل النشر: ${publishedVideos.length} فيديو منشور سابقاً`);
        } catch(e) {
            console.log("⚠️ خطأ في قراءة ملف السجل، سيتم البدء من جديد");
            publishedVideos = [];
        }
    } else {
        console.log("📝 لا يوجد سجل سابق، سيتم البدء من البداية");
    }
    
    // البحث عن فيديو جديد من حسابات التيك توك
    let selectedVideoId = null;
    let selectedAccount = null;
    
    // محاولة جلب فيديو جديد من كل حساب بالترتيب
    for (const account of tiktokAccounts) {
        console.log(`\n🔍 البحث في حساب: ${account}`);
        const nextVideo = await getNextVideoToPublish(account, publishedVideos);
        
        if (nextVideo) {
            selectedVideoId = nextVideo;
            selectedAccount = account;
            console.log(`✅ تم العثور على فيديو جديد للنشر: ${nextVideo}`);
            break;
        } else {
            console.log(`ℹ️ لا توجد فيديوهات جديدة للنشر في هذا الحساب`);
        }
    }
    
    // إذا لم نجد أي فيديو جديد
    if (!selectedVideoId) {
        console.log("\n🎉 مبروك! تم نشر جميع الفيديوهات من جميع الحسابات!");
        console.log(`📊 إجمالي الفيديوهات المنشورة: ${publishedVideos.length}`);
        
        // عرض آخر 5 فيديوهات منشورة
        if (fullHistory.length > 0) {
            console.log("\n📋 آخر 5 فيديوهات تم نشرها:");
            const last5 = fullHistory.slice(-5);
            last5.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.videoId} - ${item.title || 'بدون عنوان'}`);
            });
        }
        return;
    }
    
    // نشر الفيديو الجديد
    console.log("\n📤 بدء عملية النشر...");
    console.log(`🎯 الفيديو المختار: ${selectedVideoId}`);
    console.log(`📱 من حساب: ${selectedAccount}`);
    
    try {
        const result = await publishSingleVideo(selectedVideoId, selectedAccount);
        
        if (result.success) {
            // تحديث سجل النشر
            publishedVideos.push(selectedVideoId);
            
            // حفظ السجل بشكل متقدم
            const historyData = {
                publishedVideos: publishedVideos,
                lastPublished: new Date().toISOString(),
                totalPublished: publishedVideos.length,
                history: [
                    ...(fullHistory),
                    {
                        videoId: selectedVideoId,
                        youtubeId: result.youtubeId,
                        title: result.title,
                        account: selectedAccount,
                        publishedAt: result.publishedAt
                    }
                ]
            };
            
            fs.writeFileSync(DB_FILE, JSON.stringify(historyData, null, 2));
            console.log("\n✅ تم حفظ السجل بنجاح!");
            
            // فحص الفيديو السابق
            await checkPreviousVideoStatus();
            
            // عرض إحصائيات
            console.log("\n📊 إحصائيات النشر:");
            console.log(`   ✅ الفيديو المنشور: ${selectedVideoId}`);
            console.log(`   🔗 رابط اليوتيوب: https://youtu.be/${result.youtubeId}`);
            console.log(`   📅 تاريخ النشر: ${result.publishedAt}`);
            console.log(`   📈 إجمالي المنشورات: ${publishedVideos.length}`);
            
        } else {
            console.log("❌ فشل نشر الفيديو");
        }
        
    } catch (error) {
        console.error("❌ خطأ أثناء عملية النشر:", error.message);
        
        // تنظيف الملفات المؤقتة في حالة الخطأ
        ['input.mp4', 'output.mp4'].forEach(f => { 
            if(fs.existsSync(f)) fs.unlinkSync(f); 
        });
    }
    
    console.log("\n🏁 انتهت عملية النشر (فيديو واحد)");
}

// تشغيل النظام
startKiroSystem().catch(error => {
    console.error("❌ خطأ عام في النظام:", error.message);
});
