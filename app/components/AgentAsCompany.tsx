import { FadeInUp, FadeInLeft, FadeInRight } from './ScrollReveal';
import LogoFloat from './LogoFloat';
import AnimatedText from './AnimatedText';
import { type Dictionary } from '../i18n/types';

interface AgentAsCompanyProps {
  dict: Dictionary;
}

export default function AgentAsCompany({ dict }: AgentAsCompanyProps) {
  return (
    <FadeInUp>
      <section id="agent-as-company" className="relative overflow-hidden w-full mx-auto min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] flex items-center justify-center pb-20 sm:pb-28 md:pb-36 lg:pb-40 px-4 sm:px-6 md:px-8">
        {/* 背景渐变光晕 - 移动端优化 */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute left-1/4 top-1/3 w-[80vw] h-[80vw] sm:w-[70vw] sm:h-[70vw] md:w-[60vw] md:h-[60vw] max-w-2xl max-h-2xl bg-gradient-to-br from-primary/15 via-accent/8 to-secondary/15 sm:from-primary/20 sm:via-accent/10 sm:to-secondary/20 blur-2xl sm:blur-3xl opacity-60 sm:opacity-70 dark:from-primary/30 dark:via-accent/20 dark:to-secondary/30 dark:opacity-80 dark:sm:opacity-90 rounded-full" />
        </div>
        
        {/* 主要内容容器 - 移动端布局优化 */}
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-7 md:gap-10 w-full max-w-6xl lg:justify-around mt-30">
          {/* Logo 区域 - 移动端尺寸调整 */}
          <FadeInLeft delay={0.1}>
            <LogoFloat 
              src="/logo_ai_agent.png" 
              alt="AI Agent Logo" 
              width={100} 
              height={100} 
              className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-36 lg:h-36" 
            />
          </FadeInLeft>
          
          {/* 文本内容区域 - 移动端文本和间距优化 */}
          <FadeInRight delay={0.2}>
            <div className="flex-1 text-center md:text-left flex flex-col justify-center">
              {/* 标题 - 移动端字体大小调整 */}
              <AnimatedText 
                text={dict.agentAsCompany.title}
                as="h2"
                className="text-2xl lg:text-4xl mb-3 sm:mb-4 font-extrabold tech-heading tracking-tight leading-tight gradient-text-flow"
                delay={0.3}
              />
              
              {/* 描述文本 - 移动端行高和字体大小优化 */}
              {/* <p className="text-base sm:text-lg md:text-xl text-base-content/90 leading-relaxed tech-text mb-4 sm:mb-5 max-w-2xl mx-auto md:mx-0">
                {dict.agentAsCompany.description}
                <span className="font-bold"> {dict.agentAsCompany.speakers}</span>
                {dict.agentAsCompany.period}
              </p> */}

              <p className="text-sm lg:text-base text-base-content/80 mb-8 leading-loose tech-text max-w-4xl">
                {dict.agentAsCompany.description
                  .split("\n")
                  .map((line, index) => (
                    <span key={index}>
                      {line.split(/(\*\*.*?\*\*)/).map((part, partIndex) => {
                        if (part.startsWith("**") && part.endsWith("**")) {
                          return (
                            <strong
                              className="hero-gradient-text"
                              key={partIndex}
                            >
                              {part.slice(2, -2)}
                            </strong>
                          );
                        }
                        return part;
                      })}
                      {index <
                        dict.agentAsCompany.description.split("\n").length -
                          1 && <br />}
                    </span>
                  ))}
              </p>
              
              {/* 按钮组 */}
              <FadeInUp delay={0.7}>
                <div className="flex gap-4 flex-wrap">
                  <a href="https://github.com/NonceGeek/scaffold-tai-shang-evm-on-chain-ai-agent/blob/main/deck.pdf" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-base group relative overflow-hidden btn-shimmer">
                    👀&nbsp;&nbsp; See More Details...
                  </a>
                </div>
              </FadeInUp>

              {/* 统计数据区域 - 移动端布局优化 */}
              <div className="flex flex-col items-center md:items-start gap-2 mt-1">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-2 sm:gap-3 animate-fade-in-up animate-delay-400"></div>
              </div>
            </div>
          </FadeInRight>
        </div>
      </section>
    </FadeInUp>
  );
} 