import { Children, isValidElement, useMemo } from "react";
import type {
  ChangeEvent,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import {
  ResponsiveSelector,
  type SelectorGroup,
  type SelectorOption,
} from "@/components/ResponsiveSelector";
import { cn } from "@/lib/utils";

type SelectChildProps = {
  value?: string;
  disabled?: boolean;
  label?: string;
  children?: ReactNode;
};

interface ResponsiveSelectProps
  extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "onChange" | "children"
  > {
  children?: ReactNode;
  label?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}

function textFromChildren(children: ReactNode): string {
  return Children.toArray(children)
    .map(child =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : ""
    )
    .join("")
    .trim();
}

function optionFromElement(
  element: ReactElement<SelectChildProps>
): SelectorOption | null {
  const value = element.props.value;
  if (value === undefined || element.props.disabled) return null;
  return {
    value: String(value),
    label: textFromChildren(element.props.children),
  };
}

export function ResponsiveSelect({
  children,
  value,
  defaultValue,
  onChange,
  className,
  id,
  disabled,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  label,
  ...props
}: ResponsiveSelectProps) {
  const { options, groups } = useMemo(() => {
    const plain: SelectorOption[] = [];
    const grouped: SelectorGroup[] = [];
    Children.forEach(children, child => {
      if (!isValidElement<SelectChildProps>(child)) return;
      if (child.type === "optgroup") {
        const groupOptions = Children.toArray(child.props.children)
          .filter(
            (option): option is ReactElement<SelectChildProps> =>
              isValidElement(option) && option.type === "option"
          )
          .map(optionFromElement)
          .filter((option): option is SelectorOption => option !== null);
        if (groupOptions.length)
          grouped.push({
            label: String(child.props.label ?? ""),
            options: groupOptions,
          });
      } else if (child.type === "option") {
        const option = optionFromElement(child);
        if (option) plain.push(option);
      }
    });
    return { options: plain, groups: grouped };
  }, [children]);

  const currentValue =
    value !== undefined
      ? String(value)
      : defaultValue !== undefined
        ? String(defaultValue)
        : "";
  const emptyOption = options.find(option => option.value === "");
  const selectableOptions = options.filter(option => option.value !== "");
  const emptyLabel = emptyOption?.label;
  const selectorLabel = label ?? ariaLabel ?? id ?? "รายการ";
  const handleValueChange = (nextValue: string) => {
    onChange?.({
      target: { value: nextValue },
    } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <ResponsiveSelector
      {...props}
      id={id}
      value={currentValue}
      onValueChange={handleValueChange}
      options={selectableOptions}
      groups={groups}
      emptyLabel={emptyLabel}
      label={selectorLabel}
      disabled={disabled}
      describedBy={describedBy}
      ariaInvalid={ariaInvalid}
      className={cn(className)}
    />
  );
}
