import { useState, useEffect } from "react";
import "./DateTimeWidget.css";
import Icon from "../../../components/common/Icon";
import GlassSurface from "../../../components/common/GlassSurface";

const DateTimeWidget = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sunTimes, setSunTimes] = useState({
    sunrise: { h: 6, m: 0 },
    sunset: { h: 18, m: 0 },
  });
  const [weatherData, setWeatherData] = useState(null);

  useEffect(() => {
    const fetchSunData = async (lat, lon) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset,uv_index_max&current_weather=true&current=apparent_temperature&timezone=auto`,
        );
        const data = await res.json();
        if (data && data.daily) {
          const sunriseDate = new Date(data.daily.sunrise[0]);
          const sunsetDate = new Date(data.daily.sunset[0]);
          setSunTimes({
            sunrise: { h: sunriseDate.getHours(), m: sunriseDate.getMinutes() },
            sunset: { h: sunsetDate.getHours(), m: sunsetDate.getMinutes() },
          });
        }
        if (data && data.current_weather) {
          const temp =
            data.current?.apparent_temperature ||
            data.current_weather.temperature;
          const uv = data.daily?.uv_index_max?.[0];
          setWeatherData({
            temp: Math.round(temp),
            code: data.current_weather.weathercode,
            windSpeed: data.current_weather.windspeed,
            uvIndex: uv ? uv.toFixed(1) : "-",
          });
        }
      } catch (err) {
        console.error("Failed to fetch weather/sun data:", err);
      }
    };

    const init = async () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) =>
            fetchSunData(position.coords.latitude, position.coords.longitude),
          () => fetchSunData(6.9271, 79.8612), // Fallback to Colombo
        );
      } else {
        fetchSunData(6.9271, 79.8612); // Fallback to Colombo
      }
    };

    init();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatLargeDate = (date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDayName = (date) => {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  };

  const getTimezoneString = (date) => {
    const offset = -date.getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? "+" : "-";
    return `GMT${sign}${hours}:${minutes.toString().padStart(2, "0")}`;
  };

  const getWeatherCondition = (code) => {
    if (code <= 1) return "Clear";
    if (code <= 3) return "Partly Cloudy";
    if (code <= 49) return "Fog";
    if (code <= 69) return "Rain";
    if (code <= 79) return "Snow";
    if (code <= 99) return "Storm";
    return "Unknown";
  };

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentMins = currentHour * 60 + currentMinute;
  const sunriseMins = sunTimes.sunrise.h * 60 + sunTimes.sunrise.m;
  const sunsetMins = sunTimes.sunset.h * 60 + sunTimes.sunset.m;

  const isNight = currentMins < sunriseMins || currentMins >= sunsetMins;

  let t = 0;
  let timeUntilText = "";

  if (isNight) {
    let targetMins = sunriseMins;
    if (currentMins >= sunsetMins) {
      targetMins += 24 * 60; // Next day's sunrise
    }
    const diff = targetMins - currentMins;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    timeUntilText = `Sunrise in ${hrs}h ${mins}m`;

    const totalNight = 24 * 60 - sunsetMins + sunriseMins;
    const elapsedNight =
      currentMins >= sunsetMins
        ? currentMins - sunsetMins
        : 24 * 60 - sunsetMins + currentMins;
    t = elapsedNight / totalNight;
  } else {
    const targetMins = sunsetMins;
    const diff = targetMins - currentMins;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    timeUntilText = `Sunset in ${hrs}h ${mins}m`;

    const totalDay = sunsetMins - sunriseMins;
    const elapsedDay = currentMins - sunriseMins;
    t = elapsedDay / totalDay;
  }

  t = Math.max(0, Math.min(1, t)); // clamp

  const dotX = 10 + t * 80;
  const dotY = 20 + Math.cos(t * Math.PI * 2) * 15;

  const generateWavePath = (startT, endT) => {
    let d = "";
    const steps = 40; // High resolution for smooth curve
    const range = endT - startT;
    for (let i = 0; i <= steps; i++) {
      const currentT = startT + (i / steps) * range;
      const x = 10 + currentT * 80;
      const y = 20 + Math.cos(currentT * Math.PI * 2) * 15;
      if (i === 0) d += `M ${x} ${y} `;
      else d += `L ${x} ${y} `;
    }
    return d;
  };

  const fullPath = generateWavePath(0, 1);
  const getWeatherIconName = (code, night) => {
    if (code <= 1) return night ? "clear_night" : "clear_day";
    if (code <= 3) return night ? "partly_cloudy_night" : "partly_cloudy_day";
    if (code <= 49) return "foggy";
    if (code <= 69) return "rainy";
    if (code <= 79) return "snowing";
    if (code <= 99) return "thunderstorm";
    return "cloud";
  };
  const activePath = t > 0 ? generateWavePath(0, t) : "";

  const weatherGradient = isNight
    ? "radial-gradient(ellipse 180% 80% at 50% 100%, rgba(61, 90, 254, 0.6) 0%, transparent 70%)"
    : "radial-gradient(ellipse 180% 80% at 50% 100%, rgba(41, 182, 246, 0.6) 0%, transparent 70%)";

  const timeGradient =
    "radial-gradient(ellipse 180% 80% at 50% 100%, rgba(0, 184, 212, 0.6) 0%, transparent 70%)";
  const sunCycleGradient =
    "radial-gradient(ellipse 180% 80% at 50% 100%, rgba(0, 230, 118, 0.5) 0%, transparent 70%)";

  return (
    <>
      <div className="datetime-widget-container mod-time-date">
        <GlassSurface
          width="100%"
          height="100%"
          borderRadius={20}
          className="datetime-widget-box"
        >
          <div
            className="widget-gradient"
            style={{ background: timeGradient }}
          />
          <div className="datetime-time">{formatLargeDate(currentTime)}</div>
          <div className="datetime-date">{formatDayName(currentTime)}</div>
          <div className="datetime-timezone">
            {getTimezoneString(currentTime)}
          </div>
        </GlassSurface>
      </div>

      <div className="datetime-widget-container mod-sun-cycle">
        <GlassSurface
          width="100%"
          height="100%"
          borderRadius={20}
          className="datetime-widget-box"
        >
          <div
            className="widget-gradient"
            style={{ background: sunCycleGradient }}
          />
          <div className="sun-cycle-indicator">
            <svg
              width="100"
              height="45"
              className="sun-cycle-svg"
              style={{ overflow: "visible" }}
            >
              <path
                d={fullPath}
                fill="none"
                className="sun-path-line"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {t > 0 && (
                <path
                  d={activePath}
                  fill="none"
                  className="sun-path-active"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <circle cx={dotX} cy={dotY} r="4" className="sun-cycle-dot" />
              <circle cx="10" cy="35" r="2.5" className="sun-start-dot" />
              <circle cx="90" cy="35" r="2.5" className="sun-end-dot" />
            </svg>
            <div className="sun-cycle-text">
              <span>{timeUntilText}</span>
            </div>
          </div>
        </GlassSurface>
      </div>

      <div className="datetime-widget-container mod-weather">
        <GlassSurface
          width="100%"
          height="100%"
          borderRadius={20}
          className="datetime-widget-box"
        >
          <div
            className="widget-gradient"
            style={{ background: weatherGradient }}
          />
          <div className="weather-info-left">
            {weatherData && (
              <>
                <div className="datetime-weather-info">
                  <span className="weather-temp">{weatherData.temp}°C</span>
                  <span className="weather-cond">
                    {getWeatherCondition(weatherData.code)}
                  </span>
                </div>
                <div className="weather-extras">
                  <div className="weather-extra-item">
                    <Icon name="air" modifiers="sm" />
                    <span>{weatherData.windSpeed} km/h</span>
                  </div>
                  <div className="weather-extra-item">
                    <Icon name="beach_access" modifiers="sm" />
                    <span>UV {weatherData.uvIndex}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="weather-icon-material">
            <GlassSurface
              width={80}
              height={80}
              borderRadius={16}
              displace={200}
              backgroundOpacity={0}
              blur={16}
              saturation={-20}
              distortionScale={100}
              redOffset={0}
              greenOffset={10}
              blueOffset={10}
            >
              <Icon
                name={getWeatherIconName(weatherData?.code || 0, isNight)}
              />
            </GlassSurface>
          </div>
        </GlassSurface>
      </div>
    </>
  );
};

export default DateTimeWidget;
