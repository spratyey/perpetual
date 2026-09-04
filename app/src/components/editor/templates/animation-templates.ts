import { interpolate, Easing } from "remotion";

export type AnimationTemplate = {
  name: string;
  preview: string;
  category: "basic" | "slide" | "advanced";
  isPro?: boolean;
  enter: (
    frame: number,
    durationInFrames: number
  ) => {
    transform?: string;
    opacity?: number;
    filter?: string;
    clipPath?: string;
  };
  exit: (
    frame: number,
    durationInFrames: number
  ) => {
    transform?: string;
    opacity?: number;
    filter?: string;
    clipPath?: string;
  };
};

const ANIM_FRAMES = 15;

export const animationTemplates: Record<string, AnimationTemplate> = {
  fade: {
    name: "Fade",
    preview: "Simple fade in/out",
    category: "basic",
    enter: (frame) => ({
      opacity: interpolate(frame, [0, ANIM_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
      }),
    }),
    exit: (frame, duration) => ({
      opacity: interpolate(frame, [duration - ANIM_FRAMES, duration], [1, 0], {
        extrapolateLeft: "clamp",
      }),
    }),
  },
  slideLeft: {
    name: "Slide Left",
    preview: "Slide in from left",
    category: "slide",
    enter: (frame) => ({
      transform: `translateX(${interpolate(frame, [0, ANIM_FRAMES], [-100, 0], {
        extrapolateRight: "clamp",
      })}%)`,
      opacity: interpolate(frame, [0, ANIM_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
      }),
    }),
    exit: (frame, duration) => ({
      transform: `translateX(${interpolate(frame, [duration - ANIM_FRAMES, duration], [0, -100], {
        extrapolateLeft: "clamp",
      })}%)`,
      opacity: interpolate(frame, [duration - ANIM_FRAMES, duration], [1, 0], {
        extrapolateLeft: "clamp",
      }),
    }),
  },
  slideRight: {
    name: "Slide Right",
    preview: "Slide in from right",
    category: "slide",
    enter: (frame) => ({
      transform: `translateX(${interpolate(frame, [0, ANIM_FRAMES], [100, 0], {
        extrapolateRight: "clamp",
      })}%)`,
      opacity: interpolate(frame, [0, ANIM_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
      }),
    }),
    exit: (frame, duration) => ({
      transform: `translateX(${interpolate(frame, [duration - ANIM_FRAMES, duration], [0, 100], {
        extrapolateLeft: "clamp",
      })}%)`,
      opacity: interpolate(frame, [duration - ANIM_FRAMES, duration], [1, 0], {
        extrapolateLeft: "clamp",
      }),
    }),
  },
  slideUp: {
    name: "Slide Up",
    preview: "Slide in from bottom",
    category: "slide",
    enter: (frame) => ({
      transform: `translateY(${interpolate(frame, [0, ANIM_FRAMES], [100, 0], {
        extrapolateRight: "clamp",
      })}%)`,
      opacity: interpolate(frame, [0, ANIM_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
      }),
    }),
    exit: (frame, duration) => ({
      transform: `translateY(${interpolate(frame, [duration - ANIM_FRAMES, duration], [0, -100], {
        extrapolateLeft: "clamp",
      })}%)`,
      opacity: interpolate(frame, [duration - ANIM_FRAMES, duration], [1, 0], {
        extrapolateLeft: "clamp",
      }),
    }),
  },
  slideDown: {
    name: "Slide Down",
    preview: "Slide in from top",
    category: "slide",
    enter: (frame) => ({
      transform: `translateY(${interpolate(frame, [0, ANIM_FRAMES], [-100, 0], {
        extrapolateRight: "clamp",
      })}%)`,
      opacity: interpolate(frame, [0, ANIM_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
      }),
    }),
    exit: (frame, duration) => ({
      transform: `translateY(${interpolate(frame, [duration - ANIM_FRAMES, duration], [0, 100], {
        extrapolateLeft: "clamp",
      })}%)`,
      opacity: interpolate(frame, [duration - ANIM_FRAMES, duration], [1, 0], {
        extrapolateLeft: "clamp",
      }),
    }),
  },
  scale: {
    name: "Scale",
    preview: "Scale in/out",
    category: "basic",
    enter: (frame) => ({
      transform: `scale(${interpolate(frame, [0, ANIM_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
      })})`,
      opacity: interpolate(frame, [0, ANIM_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
      }),
    }),
    exit: (frame, duration) => ({
      transform: `scale(${interpolate(frame, [duration - ANIM_FRAMES, duration], [1, 0], {
        extrapolateLeft: "clamp",
      })})`,
      opacity: interpolate(frame, [duration - ANIM_FRAMES, duration], [1, 0], {
        extrapolateLeft: "clamp",
      }),
    }),
  },
  scaleUp: {
    name: "Pop",
    preview: "Pop in with overshoot",
    category: "basic",
    enter: (frame) => {
      const progress = interpolate(frame, [0, ANIM_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.back(1.7)),
      });
      return {
        transform: `scale(${progress})`,
        opacity: interpolate(frame, [0, 5], [0, 1], { extrapolateRight: "clamp" }),
      };
    },
    exit: (frame, duration) => {
      const progress = interpolate(frame, [duration - ANIM_FRAMES, duration], [1, 0], {
        extrapolateLeft: "clamp",
        easing: Easing.in(Easing.back(1.7)),
      });
      return {
        transform: `scale(${progress})`,
        opacity: interpolate(frame, [duration - 5, duration], [1, 0], { extrapolateLeft: "clamp" }),
      };
    },
  },
  flip: {
    name: "Flip",
    preview: "Flip horizontally",
    category: "advanced",
    enter: (frame) => ({
      transform: `perspective(400px) rotateY(${interpolate(frame, [0, ANIM_FRAMES], [90, 0], {
        extrapolateRight: "clamp",
      })}deg)`,
      opacity: interpolate(frame, [0, ANIM_FRAMES / 2], [0, 1], {
        extrapolateRight: "clamp",
      }),
    }),
    exit: (frame, duration) => ({
      transform: `perspective(400px) rotateY(${interpolate(frame, [duration - ANIM_FRAMES, duration], [0, -90], {
        extrapolateLeft: "clamp",
      })}deg)`,
      opacity: interpolate(frame, [duration - ANIM_FRAMES / 2, duration], [1, 0], {
        extrapolateLeft: "clamp",
      }),
    }),
  },
  blur: {
    name: "Blur",
    preview: "Blur in/out",
    category: "advanced",
    enter: (frame) => ({
      filter: `blur(${interpolate(frame, [0, ANIM_FRAMES], [20, 0], {
        extrapolateRight: "clamp",
      })}px)`,
      opacity: interpolate(frame, [0, ANIM_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
      }),
    }),
    exit: (frame, duration) => ({
      filter: `blur(${interpolate(frame, [duration - ANIM_FRAMES, duration], [0, 20], {
        extrapolateLeft: "clamp",
      })}px)`,
      opacity: interpolate(frame, [duration - ANIM_FRAMES, duration], [1, 0], {
        extrapolateLeft: "clamp",
      }),
    }),
  },
  bounce: {
    name: "Bounce",
    preview: "Bounce in from bottom",
    category: "advanced",
    enter: (frame) => {
      const progress = interpolate(frame, [0, ANIM_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.bounce),
      });
      return {
        transform: `translateY(${interpolate(progress, [0, 1], [80, 0])}%)`,
        opacity: interpolate(frame, [0, 5], [0, 1], { extrapolateRight: "clamp" }),
      };
    },
    exit: (frame, duration) => {
      const progress = interpolate(frame, [duration - ANIM_FRAMES, duration], [0, 1], {
        extrapolateLeft: "clamp",
      });
      return {
        transform: `translateY(${interpolate(progress, [0, 1], [0, 80])}%)`,
        opacity: interpolate(frame, [duration - 5, duration], [1, 0], { extrapolateLeft: "clamp" }),
      };
    },
  },
  wipe: {
    name: "Wipe",
    preview: "Wipe reveal from left",
    category: "advanced",
    enter: (frame) => ({
      clipPath: `inset(0 ${interpolate(frame, [0, ANIM_FRAMES], [100, 0], {
        extrapolateRight: "clamp",
      })}% 0 0)`,
    }),
    exit: (frame, duration) => ({
      clipPath: `inset(0 0 0 ${interpolate(frame, [duration - ANIM_FRAMES, duration], [0, 100], {
        extrapolateLeft: "clamp",
      })}%)`,
    }),
  },
};
