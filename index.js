const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

// --- 1. إعدادات اليوتيوب (استخدام معلوماتك التجريبية) ---
const YOUTUBE_CONFIG = {
  clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
  clientSecret: "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",
  refreshToken: "1//0402McOnnSfYTCgYIARAAGAQSNwF-L9IrHIeF6t-siXlEk4OREx_1gtOf8_8qEdHq3kDNHMnWpOMWyomF6FndgZvgiFwGYMyAwd4"
};

const oauth2Client = new google.auth.OAuth2(YOUTUBE_CONFIG.clientId, YOUTUBE_CONFIG.clientSecret);
oauth2Client.setCredentials({ refresh_token: YOUTUBE_CONFIG.refreshToken });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// --- 2. الإعدادات العامة ---
const tiktokAccounts = [
    'https://www.tiktok.com/@films2026_', // ضع حساباتك هنا
    'https://www.tiktok.com/@sekaleahmed'
];
const DB_FILE = 'history.json';
const MY_SITE = "https://redirectauto4kiro.blogspot.com/";

async function runKiroAutomation() {
    let publishedVideos = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
    const randomAccount = tiktokAccounts[Math.floor(Math.random() * tiktokAccounts.length)];
    
    try {
        console.log(`فحص الحساب: ${randomAccount}`);
        const output = execSync(`yt-dlp --get-id --playlist-items 20 "${randomAccount}"`, { encoding: 'utf-8' });
        const videoIds = output.trim().split('\n').filter(id => id.length > 0);

        let videoToUpload = null;
        for (const id of videoIds) {
            if (!publishedVideos.includes(id)) { videoToUpload = id; break; }
        }

        if (!videoToUpload) {
            console.log("الكل منشور. شكراً لك.");
            return;
        }

        // تحميل ومعالجة الفيديو (زوم 125% لتغيير البصمة)
        console.log("تحميل ومعالجة الفيديو...");
        execSync(`yt-dlp -f "best" -o "input.mp4" "https://www.tiktok.com/@any/video/${videoToUpload}"`);
        execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.25:ih*1.25,crop=iw/1.25:ih/1.25" -c:v libx264 -crf 20 -y output.mp4`);

        // --- 3. تجهيز الوصف والكلمات المفتاحية بشكل غير مباشر ---
        const videoTitle = "أقوى لقطات الأفلام والمسلسلات الحصرية 🎬 #Shorts";
        const videoDescription = `استمتع بمشاهدة أفضل مقتطفات السينما العالمية. 🍿\n\nإذا كنت تبحث عن تجربة مشاهدة فريدة ومعلومات إضافية عن هذه الأعمال، فقد وضعنا لكم دليلاً كاملاً في الرابط الموجود في أول تعليق مثبت أسفل الفيديو. 👇\n\n#أفلام #مسلسلات #Shorts #Movies #Kiro_Cinema`;

        // --- 4. النشر على يوتيوب ---
        console.log("نشر الفيديو...");
        const videoRes = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: videoTitle,
                    description: videoDescription,
                    tags: ['أفلام', 'مسلسلات', 'Movies', 'Cinema', 'Shorts'],
                    categoryId: '24' // Entertainment
                },
                status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
            },
            media: { body: fs.createReadStream('output.mp4') }
        });

        const newVideoId = videoRes.data.id;
        console.log(`تم النشر! ID: ${newVideoId}`);

        // --- 5. إضافة التعليق المثبت المقنع ---
        console.log("إضافة التعليق المثبت...");
        await youtube.commentThreads.insert({
            part: 'snippet',
            requestBody: {
                snippet: {
                    videoId: newVideoId,
                    topLevelComment: {
                        snippet: {
                            textDisplay: `هل تبحث عن الفيلم الكامل أو المزيد من التوصيات؟ شاهد القائمة الكاملة والحصرية من هنا: ${MY_SITE} ✨🍿`
                        }
                    }
                }
            }
        });

        // تحديث السجل
        publishedVideos.push(videoToUpload);
        fs.writeFileSync(DB_FILE, JSON.stringify(publishedVideos, null, 2));

        console.log("تمت العملية بنجاح كامل.");

    } catch (error) {
        console.error("فشل السكربت:", error.message);
    }
}

runKiroAutomation();
