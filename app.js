import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import resetRouter from './routes/reset.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getTranslations, getSupportedLanguages } from './utils/i18n.js';

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api', limiter);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('etag', false);

// Отключаем кэширование EJS в development
if (process.env.NODE_ENV !== 'production') {
  app.set('view cache', false);
}

app.get('/', (req, res) => {
  const lang = req.query.lang || req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'ru';
  const validLang = getSupportedLanguages().includes(lang) ? lang : 'ru';
  const t = (key) => {
    const translations = getTranslations(validLang);
    return translations[key] || translations.en[key] || key;
  };
  console.log(`Rendering with lang=${validLang}, t=${typeof t}`);
  res.render('index', { lang: validLang, t });
});

app.use('/api', resetRouter);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 