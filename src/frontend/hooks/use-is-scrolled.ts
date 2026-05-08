import { type RefObject, useEffect, useState } from "react";

export function useIsScrolled(
 ref: RefObject<HTMLElement | null>,
 threshold = 0,
) {
 const [isScrolled, setIsScrolled] = useState(false);

 useEffect(() => {
 const el = ref.current;
 if (!el) return;

 const update = () => setIsScrolled(el.scrollTop > threshold);
 update();
 el.addEventListener("scroll", update, { passive: true });
 return () => el.removeEventListener("scroll", update);
 }, [ref, threshold]);

 return isScrolled;
}
