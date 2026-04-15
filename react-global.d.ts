import type * as ReactTypes from "react";

declare global {
  namespace React {
    type ReactNode = ReactTypes.ReactNode;
    type ReactElement<P = any, T extends string | ReactTypes.JSXElementConstructor<any> = string | ReactTypes.JSXElementConstructor<any>> = ReactTypes.ReactElement<P, T>;
    type ComponentType<P = any> = ReactTypes.ComponentType<P>;
    type ComponentClass<P = any> = ReactTypes.ComponentClass<P>;
    type Component<P = {}, S = {}> = ReactTypes.Component<P, S>;
    type ErrorInfo = ReactTypes.ErrorInfo;
    type ChangeEvent<T = Element> = ReactTypes.ChangeEvent<T>;
    type FormEvent<T = Element> = ReactTypes.FormEvent<T>;
    type KeyboardEvent<T = Element> = ReactTypes.KeyboardEvent<T>;
    type TouchEvent<T = Element> = ReactTypes.TouchEvent<T>;
    type MouseEvent<T = Element> = ReactTypes.MouseEvent<T>;
    type SyntheticEvent<T = Element, E = Event> = ReactTypes.SyntheticEvent<T, E>;
    type CSSProperties = ReactTypes.CSSProperties;
    type HTMLAttributes<T = Element> = ReactTypes.HTMLAttributes<T>;
    type ButtonHTMLAttributes<T = HTMLButtonElement> = ReactTypes.ButtonHTMLAttributes<T>;
    type ForwardRefExoticComponent<P> = ReactTypes.ForwardRefExoticComponent<P>;
    type PropsWithoutRef<P> = ReactTypes.PropsWithoutRef<P>;
    type RefAttributes<T> = ReactTypes.RefAttributes<T>;
    type Ref<T> = ReactTypes.Ref<T>;
    type RefObject<T> = ReactTypes.RefObject<T>;
    type MutableRefObject<T> = ReactTypes.MutableRefObject<T>;
    type Dispatch<A> = ReactTypes.Dispatch<A>;
    type SetStateAction<S> = ReactTypes.SetStateAction<S>;
    type FormEventHandler<T = Element> = ReactTypes.FormEventHandler<T>;
    type ChangeEventHandler<T = Element> = ReactTypes.ChangeEventHandler<T>;
    type KeyboardEventHandler<T = Element> = ReactTypes.KeyboardEventHandler<T>;
    type TouchEventHandler<T = Element> = ReactTypes.TouchEventHandler<T>;
  }
}

export {};
