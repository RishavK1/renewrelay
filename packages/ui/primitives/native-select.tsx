"use client";
// Form-compatible shared picker. Radix Select 2.4.1 (MIT) owns popup positioning,
// collisions, keyboard navigation and typeahead. Existing select props are preserved.
import { Children, isValidElement, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

type OptionProps = ComponentProps<"option">;
type GroupProps = ComponentProps<"optgroup">;
function textOf(node: ReactNode): string { return Children.toArray(node).map(child => typeof child === "string" || typeof child === "number" ? String(child) : isValidElement<{children?:ReactNode}>(child) ? textOf(child.props.children) : "").join(""); }
function collectValues(children: ReactNode): string[] { return Children.toArray(children).flatMap(child => { if (!isValidElement<OptionProps & GroupProps>(child)) return []; return child.type === "optgroup" || child.type === NativeSelectOptGroup ? collectValues(child.props.children) : child.type === "option" || child.type === NativeSelectOption ? [String(child.props.value ?? textOf(child.props.children))] : []; }); }
function options(children: ReactNode, empty: string, disabledGroup = false): ReactNode { return Children.map(children, child => {
  if (!isValidElement<OptionProps & GroupProps>(child)) return null;
  if (child.type === "optgroup" || child.type === NativeSelectOptGroup) return <Select.Group><Select.Label className="rr-select-menu__label">{child.props.label}</Select.Label>{options(child.props.children,empty,!!child.props.disabled)}</Select.Group>;
  if (child.type !== "option" && child.type !== NativeSelectOption) return null;
  const value=String(child.props.value ?? textOf(child.props.children));
  return <Select.Item className="rr-select-menu__item" value={value || empty} disabled={disabledGroup || child.props.disabled} textValue={textOf(child.props.children)}><Select.ItemIndicator className="rr-select-menu__indicator"><Check size={16} aria-hidden="true" /></Select.ItemIndicator><Select.ItemText>{child.props.children}</Select.ItemText></Select.Item>;
}); }
export function NativeSelect({ className = "", children, id, value, defaultValue, disabled, required, name, onChange, ref, ...props }: ComponentProps<"select">) {
  const native = useRef<HTMLSelectElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [local,setLocal]=useState(String(defaultValue ?? collectValues(children)[0] ?? ""));
  const [container,setContainer]=useState<HTMLElement | null>(null);
  useEffect(()=>{const form=native.current?.form;if(!form)return;const reset=()=>{queueMicrotask(()=>setLocal(native.current?.value ?? ""));};form.addEventListener("reset",reset);return()=>form.removeEventListener("reset",reset);},[]);
  const values=collectValues(children); let empty="__renewrelay_empty_option__"; while(values.includes(empty))empty+="_";
  const current=String(value ?? local), labelId=id ? `${id}-value` : undefined;
  return <div className="rr-native-select" data-slot="native-select-wrapper">
    <select {...props} ref={node=>{native.current=node;if(typeof ref==="function")ref(node);else if(ref)ref.current=node;}} value={value} defaultValue={defaultValue} name={name} disabled={disabled} required={required} tabIndex={-1} aria-hidden="true" className="rr-native-select__form-control" onFocus={()=>trigger.current?.focus()} onChange={event=>{setLocal(event.target.value);onChange?.(event);}}>{children}</select>
    <Select.Root value={current || empty} disabled={disabled} required={required} onOpenChange={open=>{if(open)setContainer(trigger.current?.closest("dialog") ?? null);}} onValueChange={next=>{const actual=next===empty ? "" : next;if(!native.current)return;native.current.value=actual;native.current.dispatchEvent(new Event("change",{bubbles:true}));}}>
      <Select.Trigger ref={trigger} id={id} className={`rr-native-select__trigger ${className}`} aria-invalid={props["aria-invalid"]} aria-describedby={props["aria-describedby"]} aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} aria-required={required} title={props.title} data-slot="native-select" style={props.style}><Select.Value id={labelId} /><Select.Icon className="rr-native-select__icon"><ChevronDown size={18} aria-hidden="true" /></Select.Icon></Select.Trigger>
      <Select.Portal container={container ?? undefined}><Select.Content className="rr-select-menu" position="popper" align="start" sideOffset={6} collisionPadding={12} avoidCollisions><Select.ScrollUpButton className="rr-select-menu__scroll"><ChevronUp size={16} aria-hidden="true" /></Select.ScrollUpButton><Select.Viewport className="rr-select-menu__viewport">{options(children,empty)}</Select.Viewport><Select.ScrollDownButton className="rr-select-menu__scroll"><ChevronDown size={16} aria-hidden="true" /></Select.ScrollDownButton></Select.Content></Select.Portal>
    </Select.Root>
  </div>;
}
export function NativeSelectOption(props: OptionProps) { return <option {...props} data-slot="native-select-option" />; }
export function NativeSelectOptGroup(props: GroupProps) { return <optgroup {...props} data-slot="native-select-optgroup" />; }
