import { styled, toggleButtonClasses, ToggleButtonGroup, toggleButtonGroupClasses } from "@mui/material";

export const SpacedToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  gap: '2rem',
  [`& .${toggleButtonGroupClasses.firstButton}, & .${toggleButtonGroupClasses.middleButton}`]:
    {
      borderBottomRightRadius: (theme.vars || theme).shape.borderRadius,
      borderBottomLeftRadius: (theme.vars || theme).shape.borderRadius,
    },
  [`& .${toggleButtonGroupClasses.lastButton}, & .${toggleButtonGroupClasses.middleButton}`]:
    {
      borderTopRightRadius: (theme.vars || theme).shape.borderRadius,
      borderTopLeftRadius: (theme.vars || theme).shape.borderRadius,
      borderTop: `1px solid ${(theme.vars || theme).palette.divider}`,
      borderBottomLeftRadius: (theme.vars || theme).shape.borderRadius,
      borderLeft: `1px solid ${(theme.vars || theme).palette.divider}`,
    },
  [`& .${toggleButtonGroupClasses.lastButton}.${toggleButtonClasses.disabled}, & .${toggleButtonGroupClasses.middleButton}.${toggleButtonClasses.disabled}`]:
    {
      borderTop: `1px solid ${(theme.vars || theme).palette.action.disabledBackground}`,
      borderLeft: `1px solid ${(theme.vars || theme).palette.action.disabledBackground}`,
    },
}));