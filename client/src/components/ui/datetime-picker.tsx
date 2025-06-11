"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"

interface DateTimePickerProps {
  date?: Date
  onSelect?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  showTime?: boolean
}

export function DateTimePicker({
  date,
  onSelect,
  placeholder = "Pick a date and time",
  className,
  disabled = false,
  showTime = true,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [timeValue, setTimeValue] = React.useState<string>(
    date ? format(date, "HH:mm") : "12:00"
  )

  React.useEffect(() => {
    setSelectedDate(date)
    if (date) {
      setTimeValue(format(date, "HH:mm"))
    }
  }, [date])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setSelectedDate(undefined)
      onSelect?.(undefined)
      return
    }

    // If we have a time value, combine it with the new date
    if (showTime && timeValue) {
      const [hours, minutes] = timeValue.split(":")
      const combinedDate = new Date(newDate)
      combinedDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
      setSelectedDate(combinedDate)
      onSelect?.(combinedDate)
    } else {
      setSelectedDate(newDate)
      onSelect?.(newDate)
    }
  }

  const handleTimeChange = (newTime: string) => {
    setTimeValue(newTime)
    
    if (selectedDate && newTime) {
      const [hours, minutes] = newTime.split(":")
      const newDate = new Date(selectedDate)
      newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
      setSelectedDate(newDate)
      onSelect?.(newDate)
    }
  }

  const formatDisplayDate = () => {
    if (!selectedDate) return placeholder
    
    if (showTime) {
      return format(selectedDate, "PPP 'at' HH:mm")
    }
    return format(selectedDate, "PPP")
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDisplayDate()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
          />
          {showTime && (
            <div className="mt-3 border-t pt-3">
              <Label htmlFor="time" className="text-sm font-medium">
                Time
              </Label>
              <div className="flex items-center space-x-2 mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="time"
                  type="time"
                  value={timeValue}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}