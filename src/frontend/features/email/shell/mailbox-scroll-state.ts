import {
  createContext,
  useContext,
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

export const MailboxScrolledContext = createContext(false);
export const MailboxSetScrolledContext =
  createContext<Dispatch<SetStateAction<boolean>> | null>(null);

export function useMailboxPageScrollState(
  ref: RefObject<HTMLElement | null>,
  threshold = 0,
) {
  const setIsScrolled = useContext(MailboxSetScrolledContext);

  useEffect(() => {
    if (!setIsScrolled) return;

    const el = ref.current;
    if (!el) {
      setIsScrolled(false);
      return;
    }

    const update = () => setIsScrolled(el.scrollTop > threshold);
    update();
    el.addEventListener("scroll", update, { passive: true });

    return () => {
      el.removeEventListener("scroll", update);
      setIsScrolled(false);
    };
  }, [ref, setIsScrolled, threshold]);
}
