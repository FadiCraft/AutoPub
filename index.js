const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

// --- 1. الإعدادات الأساسية ---
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
    'https://www.tiktok.com/@sekaleahmed'
];

// تهيئة اتصال يوتيوب
const oauth2Client = new google.auth.OAuth2(YOUTUBE_CONFIG.clientId, YOUTUBE_CONFIG.clientSecret);
oauth2Client.setCredentials({ refresh_token: YOUTUBE_CONFIG.refreshToken });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// --- 2. دوال المعالجة الذكية ---

// جلب كل معلومات الفيديو بطلب واحد لتوفير الوقت والـ IP
function getVideoData(videoId) {
    try {
        console.log(`🎬 جاري تحليل بيانات الفيديو: ${videoId}`);
        const output = execSync(`yt-dlp --print "%(title)s ||| %(description)s" "https://www.tiktok.com/@any/video/${videoId}"`, { encoding: 'utf-8' });
        const [title, description] = output.split(' ||| ');
        
        const hashtags = (description.match(/#[\w\u0600-\u06FF]+/g) || []).slice(0, 5).map(t => t.replace('#', ''));
        
        return {
            title: title.trim() || "فيديو مميز جديد",
            description: description.trim() || "",
            hashtags: hashtags
        };
    } catch (e) {
        return { title: "لقطة مميزة من عالم الأفلام 🔥", description: "", hashtags: ["أفلام", "Shorts"] };
    }
}

// إنشاء وصف احترافي يحفز على الضغط على الرابط
function buildDescription(info) {
    return `🎬 شاهد التفاصيل الكاملة أو التحميل من هنا: ${MY_SITE}\n\n` +
           `━━━━━━━━━━━━━━━━━━━━\n` +
           `${info.title}\n\n` +
           `✨ لا تنسى الاشتراك في القناة وتفعيل الجرس 🔔\n` +
           `💬 شاركنا رأيك في التعليقات!\n` +
           `━━━━━━━━━━━━━━━━━━━━\n` +
           `🏷️ #Shorts #أفلام #مسلسلات #ترند ` + info.hashtags.map(t => `#${t}`).join(' ');
}

// إضافة تعليق (سواء على فيديو جديد أو قديم)
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
        console.log(`✅ تم إضافة التعليق على الفيديو: ${videoId}`);
        return true;
    } catch (e) {
        console.error(`❌ فشل إضافة التعليق: ${e.message}`);
        return false;
    }
}

// --- 3. المحرك الأساسي (الروبوت) ---

async function startKiroSystem() {
    let publishedVideos = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
    let commentedVideos = fs.existsSync(COMMENTS_DB) ? JSON.parse(fs.readFileSync(COMMENTS_DB)) : [];

    const account = tiktokAccounts[Math.floor(Math.random() * tiktokAccounts.length)];
    console.log(`🚀 بدء العمل على حساب: ${account}`);

    try {
        // 1. جلب قائمة IDs
        const idsOutput = execSync(`yt-dlp --get-id --playlist-items 15 "${account}"`, { encoding: 'utf-8' });
        const videoIds = idsOutput.trim().split('\n').filter(id => id.length > 0);

        let targetId = videoIds.find(id => !publishedVideos.includes(id));

        if (targetId) {
            console.log(`✨ اكتشاف فيديو جديد: ${targetId}`);
            const info = getVideoData(targetId);

            // 2. التحميل والمعالجة (الزوم 125% لتغيير الـ Hash)
            execSync(`yt-dlp -f "best" -o "input.mp4" "https://www.tiktok.com/@any/video/${targetId}"`);
            console.log("🎨 جاري المعالجة بـ FFmpeg...");
            execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.25:ih*1.25,crop=iw/1.25:ih/1.25" -c:v libx264 -crf 23 -c:a aac -y output.mp4`);

            // 3. الرفع لليوتيوب
            const uploadRes = await youtube.videos.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: {
                        title: `${info.title.substring(0, 80)} 🔥 #Shorts`,
                        description: buildDescription(info),
                        tags: [...info.hashtags, 'Shorts', 'Movies', 'أفلام'],
                        categoryId: '24' 
                    },
                    status: { privacyStatus: 'public' }
                },
                media: { body: fs.createReadStream('output.mp4') }
            });

            const newYtId = uploadRes.data.id;
            console.log(`✅ تم النشر بنجاح: https://youtu.be/${newYtId}`);

            // 4. إضافة أول تعليق على الفيديو الجديد فوراً
            await postComment(newYtId, `🍿 لمشاهدة الفيلم كامل أو تحميله بجودة عالية اضغط هنا: ${MY_SITE}\n✨ نتمنى لكم مشاهدة ممتعة! ✨`);

            // تحديث السجل
            publishedVideos.push(targetId);
            fs.writeFileSync(DB_FILE, JSON.stringify(publishedVideos, null, 2));
        } else {
            console.log("ℹ️ لا يوجد فيديوهات جديدة، جاري الترويج المتبادل...");
        }

        // --- ميزة الترويج المتبادل (Cross-Promotion) ---
        // البحث عن فيديو قديم لم نعلق عليه ونضع رابط موقعنا فيه
        const ytList = await youtube.videos.list({ part: 'id', mine: true, maxResults: 20, order: 'date' });
        const oldVideo = ytList.data.items.find(v => !commentedVideos.includes(v.id));

        if (oldVideo) {
            const promoText = `🔥 هل فاتك فيلم اليوم؟ شاهد القائمة الكاملة والحصرية عبر موقعنا: ${MY_SITE} 🎬🍿`;
            if (await postComment(oldVideo.id, promoText)) {
                commentedVideos.push(oldVideo.id);
                fs.writeFileSync(COMMENTS_DB, JSON.stringify(commentedVideos, null, 2));
                console.log(`📌 تم الترويج لموقعك في فيديو قديم: ${oldVideo.id}`);
            }
        }

    } catch (error) {
        console.error("⚠️ خطأ في النظام:", error.message);
    } finally {
        // تنظيف الملفات المؤقتة
        ['input.mp4', 'output.mp4'].forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f); });
    }
}

startKiroSystem();
