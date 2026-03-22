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

// Middleware для определения языка
app.use((req, res, next) => {
  const lang = req.query.lang || req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'ru';
  req.lang = getSupportedLanguages().includes(lang) ? lang : 'ru';
  req.t = (key) => {
    const translations = getTranslations(req.lang);
    return translations[key] || key;
  };
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  res.render('index', { lang: req.lang, t: req.t });
});

app.use('/api', resetRouter);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 