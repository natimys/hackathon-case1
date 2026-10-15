import {useState} from "react";
import {Navigate, useNavigate} from "react-router-dom";
import {BrandMark} from "@/components/ui";
import {useAuth} from "@/providers/auth-provider";

const slides = [
    {
        title: "Добро пожаловать в «ДозорДом»",
        body: "Видеонаблюдение в телефоне.",
        illustration: "phone",
    },
    {
        title: "Всё под рукой",
        body: "Смотрите камеры, оплачивайте услуги и подавайте заявки.",
        illustration: "service",
    },
    {
        title: "Ваши данные под защитой",
        body: "152-ФЗ. Доступ к данным есть только у вас.",
        illustration: "privacy",
    },
] as const;

function Illustration({name}: {name: typeof slides[number]["illustration"]}) {
    if (name === "phone") return <svg viewBox="0 0 300 250" role="img" aria-label="Приложение ДозорДом на телефоне">
        <circle cx="150" cy="124" r="102" fill="#F2EDFA"/>
        <path d="M58 184c12-29 30-43 54-43s42 14 54 43" fill="#10B981" opacity=".72"/>
        <rect x="102" y="23" width="96" height="182" rx="18" fill="#1E3A8A" transform="rotate(-7 102 23)"/>
        <rect x="109" y="32" width="82" height="160" rx="12" fill="#fff" transform="rotate(-7 109 32)"/>
        <rect x="138" y="38" width="24" height="4" rx="2" fill="#D1D5DB" transform="rotate(-7 138 38)"/>
        <circle cx="149" cy="101" r="26" fill="#E9D5C9"/>
        <path d="M124 99c1-19 12-30 27-30 16 0 25 11 25 29-8-8-15-11-24-10-11 1-18 6-28 11Z" fill="#25304A"/>
        <path d="M125 137c6-16 15-24 27-24s21 8 27 24v13h-54z" fill="#AE4DC1"/>
        <path d="M207 115c15-14 34 3 19 18l-16 16-16-16c-15-15 4-32 19-18Z" fill="#AE4DC1"/>
        <circle cx="152" cy="174" r="3" fill="#D1D5DB"/>
    </svg>;
    if (name === "service") return <svg viewBox="0 0 300 250" role="img" aria-label="Помощь и сервис ДозорДом">
        <circle cx="150" cy="126" r="102" fill="#F2EDFA"/>
        <path d="M76 202c6-30 23-47 48-51l28 13 29-13c24 4 40 21 44 51H76Z" fill="#AE4DC1" opacity=".9"/>
        <path d="M109 109c0-30 17-48 42-48s42 18 42 48c0 27-18 46-42 46s-42-19-42-46Z" fill="#F2C5A7"/>
        <path d="M108 107c-5-31 13-57 44-57 29 0 44 21 42 51-9-7-18-12-30-13-18-2-36 5-56 19Z" fill="#2B2331"/>
        <path d="M118 160 98 174l18 30 26-29m49-15 20 14-18 30-26-28" fill="#fff"/>
        <rect x="185" y="54" width="72" height="91" rx="8" fill="#fff" stroke="#D1D5DB" strokeWidth="2"/>
        <path d="M198 76h43m-43 17h37m-37 17h28" stroke="#1E3A8A" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="233" cy="113" r="11" fill="#10B981"/>
        <path d="m228 113 4 4 7-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M73 79h32m-16-16v32" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round"/>
    </svg>;
    return <svg viewBox="0 0 300 250" role="img" aria-label="Защита данных и приватность">
        <circle cx="150" cy="126" r="102" fill="#F2EDFA"/>
        <path d="m61 126 89-71 89 71v76H61z" fill="#fff" stroke="#1E3A8A" strokeWidth="4" strokeLinejoin="round"/>
        <path d="M94 202v-56h43v56" fill="#EEF2FA"/>
        <rect x="152" y="112" width="70" height="65" rx="12" fill="#AE4DC1"/>
        <path d="M168 112V96c0-13 8-22 19-22s19 9 19 22v16" stroke="#1E3A8A" strokeWidth="8" strokeLinecap="round"/>
        <circle cx="187" cy="140" r="6" fill="#fff"/>
        <path d="M187 146v12" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
        <path d="M48 183c12-13 24-13 36 0m133-119c10-9 20-9 30 0" fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round"/>
    </svg>;
}

export default function WelcomePage() {
    const {isAuthenticated, isLoading} = useAuth();
    const [index, setIndex] = useState(0);
    const navigate = useNavigate();
    if (isLoading) return <main className="loading-state">Загрузка…</main>;
    if (isAuthenticated) return <Navigate to="/dashboard" replace/>;

    const finish = () => {
        try { window.localStorage.setItem("dozordom.welcome-seen", "true"); } catch { /* Continue to sign-in if storage is unavailable. */ }
        navigate("/login", {replace: true});
    };
    const slide = slides[index];

    return <main className="onboarding-page">
        <section className="onboarding-screen" aria-label={`Знакомство с ДозорДомом, экран ${index + 1} из ${slides.length}`}>
            <div className="onboarding-brand"><BrandMark/><span>ДозорДом</span></div>
            <div className="onboarding-illustration"><Illustration name={slide.illustration}/></div>
            <div className="onboarding-copy" aria-live="polite">
                <h1>{slide.title}</h1>
                <p>{slide.body}</p>
            </div>
            <div className="onboarding-dots" aria-label={`Экран ${index + 1} из ${slides.length}`}>
                {slides.map((item, dotIndex) => <span key={item.title} className={dotIndex === index ? "is-active" : ""} aria-current={dotIndex === index ? "step" : undefined}/>) }
            </div>
            <button className="onboarding-next" type="button" onClick={() => index === slides.length - 1 ? finish() : setIndex((current) => current + 1)}>
                {index === slides.length - 1 ? "Начать" : "Далее"}
            </button>
        </section>
    </main>;
}
