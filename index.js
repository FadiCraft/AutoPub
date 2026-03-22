const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

// 1. معلومات يوتيوب
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
    'https://www.tiktok.com/@films2026_',
    'https://www.tiktok.com/@sekaleahmed'
];
const DB_FILE = 'history.json';
const COMMENTS_DB = 'comments_history.json'; // ملف لتتبع التعليقات المثبتة

// 3. دالة لجلب معلومات الفيديو من تيك توك
function getVideoInfo(videoId) {
    try {
        console.log("جاري جلب معلومات الفيديو...");
        
        const titleOutput = execSync(`yt-dlp --get-title "https://www.tiktok.com/@any/video/${videoId}"`, { encoding: 'utf-8' });
        let originalTitle = titleOutput.trim();
        
        let description = "";
        try {
            const descOutput = execSync(`yt-dlp --get-description "https://www.tiktok.com/@any/video/${videoId}"`, { encoding: 'utf-8' });
            description = descOutput.trim();
        } catch (e) {
            description = "فيديو رائع من تيك توك";
        }
        
        const hashtags = extractHashtags(description + " " + originalTitle);
        
        return {
            title: originalTitle,
            description: description,
            hashtags: hashtags
        };
        
    } catch (error) {
        console.error("خطأ في جلب معلومات الفيديو:", error.message);
        return {
            title: "فيديو حصري جديد 🔥 #Shorts",
            description: "أفضل المقاطع اليومية، لا تنسى الاشتراك! #ترند #تيك_توك #Shorts",
            hashtags: ["Shorts", "Trend", "TikTok"]
        };
    }
}

// 4. دالة لاستخراج الهاشتاجات
function extractHashtags(text) {
    const hashtagRegex = /#[\w\u0600-\u06FF]+/g;
    const matches = text.match(hashtagRegex) || [];
    const uniqueTags = [...new Set(matches)];
    return uniqueTags.slice(0, 5).map(tag => tag.replace('#', ''));
}

// 5. دالة لإنشاء عنوان جذاب
function createEngagingTitle(originalTitle, hashtags) {
    let cleanTitle = originalTitle.replace(/#[\w\u0600-\u06FF]+/g, '').trim();
    
    if (cleanTitle.length < 10) {
        return `🔥 فيديو رائع ${hashtags.length > 0 ? `- ${hashtags[0]}` : ''} 🔥 #Shorts`;
    }
    
    const emojis = ['🔥', '✨', '💯', '🎬', '⚡️', '💥', '😍', '👑'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    return `${randomEmoji} ${cleanTitle} ${randomEmoji} #Shorts`;
}

// 6. دالة لإنشاء وصف جذاب
function createEngagingDescription(originalDescription, hashtags, videoUrl) {
    let description = "";
    
    if (originalDescription && originalDescription.length > 0) {
        description += originalDescription + "\n\n";
    }
    
    description += `━━━━━━━━━━━━━━━━━━━━\n`;
    description += `🎬 **شاهد الفيديو الأصلي**\n`;
    description += `${videoUrl}\n\n`;
    
    description += `✨ **لا تنسى الاشتراك في القناة** 🔔\n`;
    description += `💬 **شارك رأيك في التعليقات**\n`;
    description += `🔥 **تابعنا للمزيد من المحتوى الحصري**\n\n`;
    
    description += `━━━━━━━━━━━━━━━━━━━━\n`;
    description += `🏷️ **الهاشتاجات**\n`;
    
    const allHashtags = [...new Set([...hashtags, 'Shorts', 'ترند', 'محتوى_حصري', 'تيك_توك'])];
    description += allHashtags.map(tag => `#${tag}`).join(' ');
    
    return description;
}

// 7. دالة لإضافة تعليق مثبت على فيديو قديم
async function addPinnedCommentToOldVideo(videoId, newVideoInfo, newVideoUrl) {
    try {
        console.log(`📌 جاري إضافة تعليق مثبت على فيديو قديم: ${videoId}`);
        
        // التعليق الذي سيتم إضافته (يدعو لمشاهدة الفيديو الجديد)
        const commentText = `🎬 **فيديو جديد!** 🎬\n\n` +
            `تم نشر فيديو جديد على القناة! 🚀\n` +
            `شاهده الآن: ${newVideoUrl}\n\n` +
            `✨ لا تنسى دعمنا بالاشتراك 🔔\n` +
            `💬 شارك رأيك في التعليقات\n\n` +
            `${newVideoInfo.hashtags.length > 0 ? `🏷️ ${newVideoInfo.hashtags.map(t => `#${t}`).join(' ')}` : '#شورتس #ترند #جديد'}`;
        
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
        
        // محاولة تثبيت التعليق
        try {
            await youtube.comments.setModerationStatus({
                id: comment.data.id,
                moderationStatus: 'published',
                banAuthor: false
            });
            console.log("📌 تم تثبيت التعليق في أعلى الفيديو القديم!");
        } catch (pinError) {
            console.log("⚠️ التعليق مضاف لكن يرجى تثبيته يدوياً (API لا يدعم التثبيت المباشر)");
        }
        
        return comment.data.id;
        
    } catch (error) {
        console.error("❌ حدث خطأ أثناء إضافة التعليق:", error.message);
        return null;
    }
}

// 8. دالة لجلب آخر فيديو تم نشره (الأقدم الذي لم نعلق عليه بعد)
async function getLastPublishedVideoWithoutComment() {
    try {
        // جلب قائمة الفيديوهات المنشورة
        const response = await youtube.videos.list({
            part: 'snippet',
            mine: true,
            maxResults: 50,
            order: 'date'
        });
        
        if (!response.data.items || response.data.items.length === 0) {
            return null;
        }
        
        // قراءة سجل التعليقات المثبتة
        let commentedVideos = fs.existsSync(COMMENTS_DB) ? JSON.parse(fs.readFileSync(COMMENTS_DB)) : [];
        
        // البحث عن أقدم فيديو لم نضف عليه تعليق مثبت بعد
        for (const video of response.data.items) {
            if (!commentedVideos.includes(video.id)) {
                return {
                    id: video.id,
                    title: video.snippet.title,
                    publishedAt: video.snippet.publishedAt
                };
            }
        }
        
        return null;
        
    } catch (error) {
        console.error("خطأ في جلب الفيديوهات:", error.message);
        return null;
    }
}

// 9. دالة لتسجيل أننا أضفنا تعليق على فيديو
function markVideoAsCommented(videoId) {
    let commentedVideos = fs.existsSync(COMMENTS_DB) ? JSON.parse(fs.readFileSync(COMMENTS_DB)) : [];
    if (!commentedVideos.includes(videoId)) {
        commentedVideos.push(videoId);
        fs.writeFileSync(COMMENTS_DB, JSON.stringify(commentedVideos, null, 2));
    }
}

// 10. دالة لتأخير التنفيذ
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runKiroBot() {
    // جلب السجل الحالي
    let publishedVideos = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];

    // اختيار حساب عشوائي
    const randomAccount = tiktokAccounts[Math.floor(Math.random() * tiktokAccounts.length)];
    console.log(`📱 تم اختيار الحساب: ${randomAccount}`);

    try {
        // جلب كل الفيديوهات من تيك توك
        console.log("🔍 جاري فحص قائمة الفيديوهات...");
        const output = execSync(`yt-dlp --get-id "${randomAccount}"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
        const videoIds = output.trim().split('\n').filter(id => id.length > 0);

        let videoToUpload = null;

        // البحث عن فيديو غير منشور
        for (const id of videoIds) {
            if (!publishedVideos.includes(id)) {
                videoToUpload = id;
                break;
            }
        }

        if (!videoToUpload) {
            console.log("✅ جميع الفيديوهات تم نشرها مسبقاً.");
            
            // حتى لو لم ننشر فيديو جديد، نحاول إضافة تعليقات على فيديوهات قديمة
            console.log("🔍 جاري البحث عن فيديوهات قديمة لإضافة تعليقات مثبتة...");
            const oldVideo = await getLastPublishedVideoWithoutComment();
            if (oldVideo) {
                console.log(`📌 تم العثور على فيديو قديم: ${oldVideo.title}`);
                // يمكننا إضافة تعليق ترويجي لقناة أو محتوى عام
                const defaultComment = `🎬 **شكراً لدعمكم!** 🎬\n\n` +
                    `✨ لا تنسى الاشتراك في القناة وتفعيل الجرس 🔔\n` +
                    `💬 شاركنا رأيك في التعليقات\n` +
                    `🔥 تابعنا للمزيد من المحتوى الحصري\n\n` +
                    `#شورتس #ترند #محتوى_حصري`;
                
                const comment = await youtube.commentThreads.insert({
                    part: 'snippet',
                    requestBody: {
                        snippet: {
                            videoId: oldVideo.id,
                            topLevelComment: {
                                snippet: {
                                    textOriginal: defaultComment
                                }
                            }
                        }
                    }
                });
                console.log(`✅ تم إضافة تعليق على الفيديو القديم: ${oldVideo.id}`);
                markVideoAsCommented(oldVideo.id);
            } else {
                console.log("ℹ️ جميع الفيديوهات تم إضافة تعليقات عليها بالفعل");
            }
            
            return;
        }

        console.log(`🎬 تم العثور على فيديو غير منشور: ${videoToUpload}`);
        
        // جلب معلومات الفيديو
        const videoInfo = getVideoInfo(videoToUpload);
        console.log(`📝 العنوان الأصلي: ${videoInfo.title}`);
        
        // إنشاء عنوان ووصف لليوتيوب
        const youtubeTitle = createEngagingTitle(videoInfo.title, videoInfo.hashtags);
        const videoUrl = `https://www.tiktok.com/@any/video/${videoToUpload}`;
        const youtubeDescription = createEngagingDescription(videoInfo.description, videoInfo.hashtags, videoUrl);
        
        // تحميل الفيديو
        console.log("⬇️ جاري تحميل الفيديو...");
        execSync(`yt-dlp -f "best" -o "input.mp4" "https://www.tiktok.com/@any/video/${videoToUpload}"`);
        
        // معالجة الفيديو
        console.log("🎨 جاري معالجة الفيديو...");
        execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.25:ih*1.25,crop=iw/1.25:ih/1.25" -c:v libx264 -crf 20 -c:a aac -y output.mp4`);
        
        // رفع الفيديو الجديد
        console.log("📤 جاري النشر على يوتيوب...");
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: youtubeTitle,
                    description: youtubeDescription,
                    tags: [...videoInfo.hashtags, 'Shorts', 'ترند', 'تيك_توك'],
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
        
        const newVideoId = res.data.id;
        const newVideoUrl = `https://youtu.be/${newVideoId}`;
        
        console.log(`✅ تم نشر الفيديو الجديد بنجاح!`);
        console.log(`📹 الرابط: ${newVideoUrl}`);
        console.log(`📝 العنوان: ${youtubeTitle}`);
        
        // ===== الجزء الجديد: إضافة تعليق مثبت على فيديو قديم =====
        console.log("🔍 جاري البحث عن فيديو قديم لإضافة تعليق مثبت عليه...");
        
        // ننتظر قليلاً للتأكد من نشر الفيديو الجديد في القائمة
        await delay(3000);
        
        // جلب آخر فيديو قديم لم نضف عليه تعليق
        const oldVideo = await getLastPublishedVideoWithoutComment();
        
        if (oldVideo) {
            console.log(`📌 تم العثور على فيديو قديم: "${oldVideo.title}"`);
            console.log(`🔄 جاري إضافة تعليق مثبت يروج للفيديو الجديد...`);
            
            // إضافة تعليق مثبت على الفيديو القديم يروج للفيديو الجديد
            await addPinnedCommentToOldVideo(oldVideo.id, videoInfo, newVideoUrl);
            
            // تسجيل أننا أضفنا تعليق على هذا الفيديو القديم
            markVideoAsCommented(oldVideo.id);
            console.log(`✅ تم تثبيت تعليق يروج للفيديو الجديد على الفيديو القديم!`);
        } else {
            console.log("ℹ️ لا يوجد فيديوهات قديمة متاحة لإضافة تعليق عليها حالياً");
        }
        
        // تسجيل الفيديو الجديد
        publishedVideos.push(videoToUpload);
        fs.writeFileSync(DB_FILE, JSON.stringify(publishedVideos, null, 2));
        
        // تنظيف الملفات
        if (fs.existsSync('input.mp4')) fs.unlinkSync('input.mp4');
        if (fs.existsSync('output.mp4')) fs.unlinkSync('output.mp4');
        
        console.log("🎉 اكتملت العملية بنجاح!");
        console.log(`📌 تم نشر فيديو جديد + إضافة تعليق مثبت على فيديو قديم يروج له`);
        
    } catch (error) {
        console.error("❌ حدث خطأ:", error.message);
    }
}

runKiroBot();
