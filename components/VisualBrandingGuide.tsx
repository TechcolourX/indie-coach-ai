import React, { useState, useEffect } from 'react';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { LoadingIcon } from './icons/LoadingIcon.tsx';

interface BrandingData {
  aesthetic: {
    name: string;
    description: string;
  };
  palette: {
    role: 'Primary' | 'Secondary' | 'Accent';
    hex: string;
    name: string;
  }[];
  typography: {
    headline: {
      name: string;
      sample: string;
    };
    body: {
      name: string;
      sample: string;
    };
  };
  application: {
    emoji: string;
    title: string;
    description: string;
  }[];
}

interface VisualBrandingGuideProps {
  data: BrandingData;
}

const FONT_OPTIONS = [
  { name: 'Oswald', family: "'Oswald', sans-serif" },
  { name: 'Montserrat', family: "'Montserrat', sans-serif" },
  { name: 'Playfair Display', family: "'Playfair Display', serif" },
  { name: 'Lato', family: "'Lato', sans-serif" },
  { name: 'Inter', family: "'Inter', sans-serif" },
];

const VisualBrandingGuide: React.FC<VisualBrandingGuideProps> = ({ data }) => {
  const { aesthetic, application } = data;
  const [palette, setPalette] = useState(data.palette);
  const [typography, setTypography] = useState(data.typography);
  
  const [logoText, setLogoText] = useState('Your Artist Name');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    setPalette(data.palette);
    setTypography(data.typography);
  }, [data]);

  const handlePaletteChange = (index: number, newHex: string) => {
    const updatedPalette = [...palette];
    updatedPalette[index].hex = newHex;
    setPalette(updatedPalette);
  };

  const handleTypographyChange = (type: 'headline' | 'body', newFontName: string) => {
    setTypography(prev => ({
        ...prev,
        [type]: { ...prev[type], name: newFontName }
    }));
  };

  const handleGenerateImage = async () => {
    if (!logoText.trim()) {
        setGenerationError('Please enter your artist or brand name.');
        return;
    }
    setIsGenerating(true);
    setGeneratedImage(null);
    setGenerationError(null);

    const paletteDescription = palette.map(c => `${c.role}: ${c.name} (${c.hex})`).join(', ');
    const fullPrompt = `
    Generate a highly creative and clean typographic logo for a music artist. The logo's graphic elements must be constructed exclusively from the letters of the artist's name, exploring abstract arrangements and clever use of negative space.

    **Core Task:** Create a logo using ONLY the letters from the artist's name. The letters themselves should form the entire visual of the logo. Think abstractly about how letters can be deconstructed, rearranged, and combined to create a unique mark.

    **Instructions:**
    1.  **Text to use:** The logo must be based on the exact text: "${logoText}".
    2.  **Style & Aesthetic:** The overall style must be "${aesthetic.name}". Context: ${aesthetic.description}.
    3.  **Color Palette:** Use ONLY colors from this palette: ${paletteDescription}. The background must be a solid color from the palette. The text should use a contrasting color.
    4.  **Typography & Arrangement:** 
        - The font style must be heavily inspired by "${typography.headline.name}".
        - Be highly creative with the letterforms. Stylize, deconstruct, abstract, or arrange the letters in a unique way to create a graphic mark.
        - Explore unconventional layouts: consider vertical stacking, overlapping, interlocking shapes, or mirroring.
        - **Use negative space creatively.** The space between and within letters is as important as the letters themselves. Use it to imply shapes or add visual interest.
    5.  **Composition:** Create a clean, modern, and visually balanced logo. The logo must be centered.

    **Strict Rules - What to AVOID:**
    - **Absolutely NO icons, symbols, shapes, or illustrations.** The logo must be 100% typographic. For example, do not add a guitar, a music note, or a sound wave. The letters ARE the graphic.
    - Do NOT use any colors outside of the provided palette.
    - The artist's name must remain legible, even if abstract.
    `;

    try {
        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: fullPrompt }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        
        if (result.imageUrl) {
            setGeneratedImage(result.imageUrl);
        } else {
             throw new Error(result.error || "The AI did not return an image. Please try a different prompt.");
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Image generation failed:", errorMessage);
        setGenerationError(`Image generation failed. ${errorMessage}`);
    } finally {
        setIsGenerating(false);
    }
  };


  return (
    <div className="my-6 p-4 md:p-6 rounded-lg border border-surface-border bg-background">
      <div className="text-center border-b border-surface-border pb-4 mb-6">
        <h3 className="text-lg font-bold text-brand-orange dark:text-orange-400 uppercase tracking-wider">Visual Branding Guide</h3>
        <p className="text-2xl font-extrabold text-foreground mt-1">{aesthetic.name}</p>
        <p className="text-sm text-foreground/70 mt-2 max-w-xl mx-auto">{aesthetic.description}</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Color & Typography Column */}
        <div className="space-y-6">
          <div>
            <h4 className="font-bold text-base text-foreground mb-3">Color Palette</h4>
            <div className="flex flex-col sm:flex-row gap-4">
              {palette.map((color, index) => (
                <div key={index} className="flex-1 text-center">
                  <div 
                    className="w-full h-16 rounded-lg shadow-inner border border-black/10 transition-colors" 
                    style={{ backgroundColor: color.hex }}
                    aria-label={`${color.role} color: ${color.name}`}
                  ></div>
                  <p className="font-bold text-sm text-foreground mt-2">{color.role}</p>
                  <p className="text-xs text-foreground/70">{color.name}</p>
                  <input
                    type="text"
                    value={color.hex}
                    onChange={(e) => handlePaletteChange(index, e.target.value)}
                    className="w-24 mx-auto text-center bg-background border border-surface-border rounded-md font-mono text-xs text-foreground/80 mt-1 p-1 focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
                    aria-label={`Hex code for ${color.role} color`}
                    spellCheck="false"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-base text-foreground mb-3">Typography</h4>
            <div className="space-y-4">
               <div className="p-4 bg-surface rounded-lg">
                    <p className="text-xs font-semibold text-foreground/60 mb-1">HEADLINE</p>
                    <p className="text-2xl" style={{ fontFamily: `'${typography.headline.name}', sans-serif` }}>
                      {data.typography.headline.sample}
                    </p>
                    <select
                        value={typography.headline.name}
                        onChange={(e) => handleTypographyChange('headline', e.target.value)}
                        className="w-full mt-2 p-2 bg-background border border-surface-border rounded-md text-sm text-foreground focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
                        aria-label="Select headline font"
                    >
                        {FONT_OPTIONS.map(font => (
                            <option key={font.name} value={font.name}>{font.name}</option>
                        ))}
                    </select>
               </div>
               <div className="p-4 bg-surface rounded-lg">
                    <p className="text-xs font-semibold text-foreground/60 mb-1">BODY</p>
                    <p className="text-base leading-relaxed" style={{ fontFamily: `'${typography.body.name}', sans-serif` }}>
                      {data.typography.body.sample}
                    </p>
                     <select
                        value={typography.body.name}
                        onChange={(e) => handleTypographyChange('body', e.target.value)}
                        className="w-full mt-2 p-2 bg-background border border-surface-border rounded-md text-sm text-foreground focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
                        aria-label="Select body font"
                    >
                        {FONT_OPTIONS.map(font => (
                            <option key={font.name} value={font.name}>{font.name}</option>
                        ))}
                    </select>
               </div>
            </div>
          </div>
        </div>

        {/* Application Column */}
        <div>
          <h4 className="font-bold text-base text-foreground mb-3">Brand in Action</h4>
           <div className="space-y-6">
            {application.map((item, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="text-2xl mt-0.5" role="img" aria-label={item.title}>{item.emoji}</div>
                <div>
                    <h5 className="font-bold text-foreground leading-snug">{item.title}</h5>
                    <p className="text-sm text-foreground/80 mt-1">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-surface-border mt-8 pt-6">
        <h4 className="font-bold text-base text-foreground mb-3 text-center">Generate a Font Logo</h4>
        <p className="text-sm text-center text-foreground/70 mb-4 max-w-xl mx-auto">
            Enter your artist or brand name to create a typographic logo based on your brand guide.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto">
            <input
                type="text"
                value={logoText}
                onChange={(e) => setLogoText(e.target.value)}
                placeholder="Enter artist name or record label"
                className="flex-1 p-3 bg-background border border-surface-border rounded-lg focus:ring-0 text-foreground placeholder-color"
                disabled={isGenerating}
                aria-label="Artist name for logo generation"
            />
            <button
                onClick={handleGenerateImage}
                disabled={isGenerating || !logoText.trim()}
                className="brand-cta font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2"
            >
                {isGenerating ? <LoadingIcon /> : <SparklesIcon className="w-4 h-4" />}
                <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
            </button>
        </div>
        
        <div className="mt-6 text-center">
            {isGenerating && (
                <div className="flex flex-col items-center justify-center p-4 animate-fade-in">
                    <LoadingIcon className="w-8 h-8 text-brand-purple" />
                    <p className="text-sm text-foreground/70 mt-2">The AI is creating your logo...</p>
                </div>
            )}
            {generationError && (
                <div className="p-3 bg-red-500/10 text-red-700 dark:text-red-300 rounded-lg text-sm animate-fade-in">
                    {generationError}
                </div>
            )}
            {generatedImage && (
                <div className="animate-fade-in">
                    <img src={generatedImage} alt="AI generated font logo" className="rounded-lg max-w-sm mx-auto shadow-lg border border-surface-border" />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default VisualBrandingGuide;