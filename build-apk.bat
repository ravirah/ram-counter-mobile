@echo off
set JAVA_HOME=C:\jdk17\jdk-17.0.18+8
set GRADLE_USER_HOME=C:\gh
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d C:\rb\android
call .\gradlew.bat assembleRelease
echo BUILD_EXIT_CODE=%ERRORLEVEL%
