'use client';

import { FadeInUp } from './ScrollReveal';
import { type Dictionary } from '../i18n/types';

interface HeroContentProps {
  dict: Dictionary;
}

export default function HeroContent({ dict }: HeroContentProps) {
  return (
    <div className="hero-content text-left w-full max-w-none p-8 lg:p-12 relative z-10 pt-0 ">
      <div className="w-full">
        {/* 左下角内容区域 */}
        <div className="max-w-7xl -mt-10">
          {/* 第一行：DIMSUM AI 渐变文字 */}
          <FadeInUp delay={0.1}>
            <h1 className="text-3xl lg:text-5xl font-black tech-heading mb-2 leading-tight">
              👉 
              <span className="hero-gradient-text">
              &nbsp;&nbsp;{dict.hero.title}&nbsp;&nbsp;
              </span>
                👈
            </h1>
          </FadeInUp>

          {/* 第二行：副标题 */}
          <FadeInUp delay={0.3}>
            <h2 className="text-base lg:text-xl font-bold text-base-content mb-6 leading-tight">
              {dict.hero.subtitle}
            </h2>
          </FadeInUp>
          
          {/* 第三行：描述 */}
          <FadeInUp delay={0.5}>
            <p className="text-sm lg:text-base text-base-content/80 mb-8 leading-loose tech-text max-w-4xl">
              {dict.hero.description.split('\n').map((line, index) => (
                <span key={index}>
                  {line.split(/(\*\*.*?\*\*)/).map((part, partIndex) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                  {index < dict.hero.description.split('\n').length - 1 && <br />}
                </span>
              ))}
            </p>
          </FadeInUp>
          {/* 按钮组 */}
          <FadeInUp delay={0.7}>
            <div className="flex gap-4 flex-wrap">
              <a href="#examples" className="btn btn-primary btn-base group relative overflow-hidden btn-shimmer">
                {dict.hero.getStarted}
              </a>
              &nbsp;&nbsp;
              <a href="https://search.aidimsum.com" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-base group relative overflow-hidden btn-shimmer">
                {dict.hero.btn}
              </a>
              &nbsp;&nbsp;
              <a href="" className="btn btn-primary btn-base group relative overflow-hidden btn-shimmer">
                {dict.hero.btn_2}
              </a>
            </div>
          </FadeInUp>
          
        </div>
      </div>
    </div>
  );
} 